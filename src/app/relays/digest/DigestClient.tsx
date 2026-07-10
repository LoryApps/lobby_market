'use client'

/**
 * /relays/digest — The Weekly Relay Digest
 *
 * Magazine-style editorial roundup of relay chain activity from the
 * current week. Shows platform-wide stats, the featured relay (most
 * compelling votes), the hottest relay (most active), the week's top
 * argument legs (most starred), and the top contributors.
 *
 * Distinct from:
 *   /relays/weekly   — single "Relay of the Week" champion relay
 *   /relays/stats    — raw platform statistics dashboard
 *   /relays/league   — ranked leaderboard of weekly relays
 *   /relays/hall-of-fame — all-time best relays
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  Award,
  BarChart2,
  Flame,
  GitMerge,
  Loader2,
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
import type {
  DigestResponse,
  DigestRelay,
  DigestLeg,
  DigestContributor,
  DigestCategoryStat,
} from '@/app/api/relays/digest/route'

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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const CAT_BG: Record<string, string> = {
  Politics:    'bg-for-500/20 border-for-500/30',
  Economics:   'bg-gold/15 border-gold/30',
  Technology:  'bg-purple/15 border-purple/30',
  Science:     'bg-emerald/15 border-emerald/30',
  Ethics:      'bg-against-500/15 border-against-500/30',
  Philosophy:  'bg-purple/15 border-purple/30',
  Culture:     'bg-against-400/15 border-against-400/30',
  Health:      'bg-emerald/15 border-emerald/30',
  Education:   'bg-gold/15 border-gold/30',
  Environment: 'bg-emerald/15 border-emerald/30',
}

function catBg(cat: string | null): string {
  return cat ? (CAT_BG[cat] ?? 'bg-surface-300/20 border-surface-400/20') : 'bg-surface-300/20 border-surface-400/20'
}

const CAT_BAR: Record<string, string> = {
  Politics:    'bg-for-500',
  Economics:   'bg-gold',
  Technology:  'bg-purple',
  Science:     'bg-emerald',
  Ethics:      'bg-against-500',
  Philosophy:  'bg-purple',
  Culture:     'bg-against-400',
  Health:      'bg-emerald',
  Education:   'bg-gold',
  Environment: 'bg-emerald',
}

function catBar(cat: string): string {
  return CAT_BAR[cat] ?? 'bg-surface-400'
}

const SIDE_CONFIG = {
  for: {
    label: 'FOR',
    accent: 'text-for-400',
    border: 'border-for-700/50',
    bg: 'bg-for-900/15',
    badge: 'text-for-400 bg-for-500/10 border-for-600/30',
  },
  against: {
    label: 'AGAINST',
    accent: 'text-against-400',
    border: 'border-against-700/50',
    bg: 'bg-against-900/15',
    badge: 'text-against-400 bg-against-500/10 border-against-600/30',
  },
} as const

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  accent: string
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 p-4 rounded-xl bg-surface-200/60 border border-surface-300/50">
      <Icon className={cn('h-5 w-5', accent)} />
      <span className="text-xl font-mono font-bold text-white tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      <span className="text-[11px] text-surface-500 text-center leading-tight">{label}</span>
    </div>
  )
}

// ─── Featured relay card ──────────────────────────────────────────────────────

function FeaturedRelayCard({
  relay,
  title,
  icon: Icon,
  iconCls,
}: {
  relay: DigestRelay
  title: string
  icon: React.ComponentType<{ className?: string }>
  iconCls: string
}) {
  const s = SIDE_CONFIG[relay.side]
  return (
    <div className={cn('rounded-xl border p-4 space-y-3', s.border, s.bg)}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('h-4 w-4', iconCls)} />
        <span className="text-xs font-semibold text-surface-400 uppercase tracking-widest">{title}</span>
      </div>

      {relay.topic_statement && (
        <Link
          href={relay.topic_id ? `/topic/${relay.topic_id}` : '#'}
          className="block text-sm font-semibold text-white hover:text-for-300 transition-colors line-clamp-2"
        >
          {relay.topic_statement}
        </Link>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold border', s.badge)}>
          {relay.side === 'for' ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
          {s.label}
        </span>
        {relay.topic_category && (
          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono border', catBg(relay.topic_category))}>
            {relay.topic_category}
          </span>
        )}
        <span className="text-[11px] text-surface-500 font-mono">
          {relay.legs_count}/{relay.max_legs} legs
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs text-surface-400">
        <span className="flex items-center gap-1">
          <ThumbsUp className="h-3 w-3 text-emerald" />
          <span className="font-mono font-semibold text-white">{relay.vote_compelling}</span>
          compelling
        </span>
        {relay.compelling_pct !== null && (
          <span className="flex items-center gap-1">
            <span className="font-mono font-semibold text-emerald">{relay.compelling_pct}%</span>
            approval
          </span>
        )}
        {relay.new_legs_this_week > 0 && (
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-gold" />
            <span className="font-mono text-gold font-semibold">{relay.new_legs_this_week}</span>
            new legs
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Avatar
          src={relay.starter_avatar_url}
          fallback={relay.starter_display_name || relay.starter_username}
          size="xs"
        />
        <span className="text-[11px] text-surface-400">
          Started by{' '}
          <Link href={`/profile/${relay.starter_username}`} className="text-surface-300 hover:text-white transition-colors">
            @{relay.starter_username}
          </Link>
        </span>
        <span className="text-[11px] text-surface-600 ml-auto">{relativeTime(relay.created_at)}</span>
      </div>

      <Link
        href={`/relays/${relay.id}`}
        className={cn(
          'flex items-center justify-center gap-2 w-full py-2 rounded-lg',
          'text-xs font-semibold transition-all',
          relay.side === 'for'
            ? 'bg-for-600/25 border border-for-700/40 text-for-300 hover:bg-for-600/40'
            : 'bg-against-600/25 border border-against-700/40 text-against-300 hover:bg-against-600/40'
        )}
      >
        <GitMerge className="h-3.5 w-3.5" />
        View relay chain
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

// ─── Top leg card ─────────────────────────────────────────────────────────────

function TopLegCard({ leg, rank }: { leg: DigestLeg; rank: number }) {
  const s = SIDE_CONFIG[leg.relay_side]

  return (
    <div className="flex gap-3 p-3 rounded-xl bg-surface-200/50 border border-surface-300/40 hover:border-surface-400/50 transition-colors">
      <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-surface-300/40 text-xs font-mono font-bold text-gold">
        #{rank}
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-sm text-surface-200 leading-relaxed line-clamp-3">{leg.content}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-mono border rounded-full px-1.5 py-0.5', s.badge)}>
            {leg.relay_side === 'for' ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
            Leg {leg.leg_number}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-gold font-mono">
            <Star className="h-2.5 w-2.5 fill-gold" />
            {leg.upvote_count}
          </span>
          {leg.relay_topic_category && (
            <span className="text-[10px] text-surface-500 font-mono">{leg.relay_topic_category}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Avatar src={leg.author_avatar_url} fallback={leg.author_display_name || leg.author_username} size="xs" />
          <Link
            href={`/profile/${leg.author_username}`}
            className="text-[11px] text-surface-400 hover:text-white transition-colors"
          >
            @{leg.author_username}
          </Link>
          <Link
            href={`/relays/${leg.relay_id}`}
            className="text-[11px] text-for-400 hover:text-for-300 transition-colors ml-auto flex items-center gap-0.5"
          >
            View chain <ArrowRight className="h-2.5 w-2.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Contributor card ─────────────────────────────────────────────────────────

function ContributorCard({ contributor, rank }: { contributor: DigestContributor; rank: number }) {
  const rankColor =
    rank === 1 ? 'text-gold' : rank === 2 ? 'text-surface-300' : rank === 3 ? 'text-amber-600' : 'text-surface-500'

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/50 border border-surface-300/40 hover:border-surface-400/50 transition-colors">
      <span className={cn('text-sm font-mono font-bold w-5 text-center flex-shrink-0', rankColor)}>
        {rank}
      </span>
      <Link href={`/profile/${contributor.username}`} className="flex-shrink-0">
        <Avatar
          src={contributor.avatar_url}
          fallback={contributor.display_name || contributor.username}
          size="sm"
        />
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/profile/${contributor.username}`} className="block">
          <p className="text-sm font-semibold text-white truncate hover:text-for-300 transition-colors">
            {contributor.display_name || contributor.username}
          </p>
          <p className="text-[11px] text-surface-500">@{contributor.username}</p>
        </Link>
      </div>
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <span className="text-sm font-mono font-bold text-white">{contributor.legs_this_week}</span>
        <span className="text-[10px] text-surface-500">legs</span>
        {contributor.total_stars > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-gold font-mono">
            <Star className="h-2.5 w-2.5 fill-gold" />
            {contributor.total_stars}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Category bar ─────────────────────────────────────────────────────────────

function CategoryBar({ stat, maxRelays }: { stat: DigestCategoryStat; maxRelays: number }) {
  const pct = maxRelays > 0 ? (stat.new_relays / maxRelays) * 100 : 0

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-surface-400 w-20 flex-shrink-0 truncate font-mono">{stat.category}</span>
      <div className="flex-1 h-2 bg-surface-300/30 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', catBar(stat.category))}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay: 0.1 }}
        />
      </div>
      <span className="text-xs font-mono text-surface-300 w-12 text-right flex-shrink-0">
        {stat.new_relays} <span className="text-surface-600">relay{stat.new_relays !== 1 ? 's' : ''}</span>
      </span>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function DigestSkeleton() {
  return (
    <div className="space-y-6 px-4 py-6">
      <Skeleton className="h-8 w-48 rounded-lg" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function DigestClient() {
  const [data, setData] = useState<DigestResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/relays/digest')
      if (!res.ok) throw new Error('Failed to load digest')
      const json: DigestResponse = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const maxCatRelays = data
    ? Math.max(1, ...data.by_category.map((c) => c.new_relays))
    : 1

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />

      <main className="flex-1 pb-24 pt-4 max-w-lg mx-auto w-full px-4 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <GitMerge className="h-5 w-5 text-purple" />
              <h1 className="text-xl font-bold text-white">Relay Digest</h1>
            </div>
            {data && (
              <p className="text-sm text-surface-400">
                Week of {data.week_label}
              </p>
            )}
          </div>
          <button
            onClick={load}
            disabled={isLoading}
            aria-label="Refresh digest"
            className="p-2 rounded-xl bg-surface-200/60 border border-surface-300/50 text-surface-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </button>
        </div>

        {isLoading && <DigestSkeleton />}

        {error && (
          <EmptyState
            icon={GitMerge}
            title="Could not load digest"
            description={error}
            action={{ label: 'Try again', onClick: load }}
          />
        )}

        {!isLoading && !error && data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="digest-content"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* ── Weekly stats ──────────────────────────────────────── */}
              <section>
                <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-widest mb-3">
                  This week
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <StatTile icon={GitMerge} label="New relays" value={data.stats.new_relays} accent="text-purple" />
                  <StatTile icon={Zap} label="New legs" value={data.stats.new_legs} accent="text-gold" />
                  <StatTile icon={Users} label="Contributors" value={data.stats.unique_contributors} accent="text-for-400" />
                  <StatTile icon={ThumbsUp} label="Votes cast" value={data.stats.total_voters} accent="text-emerald" />
                </div>

                {(data.stats.for_relays > 0 || data.stats.against_relays > 0) && (
                  <div className="mt-3 flex gap-3">
                    <div className="flex-1 p-3 rounded-xl bg-for-900/20 border border-for-700/30 text-center">
                      <span className="block text-lg font-mono font-bold text-for-400">{data.stats.for_relays}</span>
                      <span className="text-[11px] text-surface-500">FOR chains</span>
                    </div>
                    <div className="flex-1 p-3 rounded-xl bg-against-900/20 border border-against-700/30 text-center">
                      <span className="block text-lg font-mono font-bold text-against-400">{data.stats.against_relays}</span>
                      <span className="text-[11px] text-surface-500">AGAINST chains</span>
                    </div>
                    {data.stats.completed_relays > 0 && (
                      <div className="flex-1 p-3 rounded-xl bg-emerald/10 border border-emerald/20 text-center">
                        <span className="block text-lg font-mono font-bold text-emerald">{data.stats.completed_relays}</span>
                        <span className="text-[11px] text-surface-500">Completed</span>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* ── Featured relay (most compelling) ─────────────────── */}
              {data.featured_relay && (
                <section>
                  <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-widest mb-3">
                    Featured relay
                  </h2>
                  <FeaturedRelayCard
                    relay={data.featured_relay}
                    title="Most compelling this week"
                    icon={Trophy}
                    iconCls="text-gold"
                  />
                </section>
              )}

              {/* ── Hottest relay (most active) ───────────────────────── */}
              {data.hottest_relay && data.hottest_relay.id !== data.featured_relay?.id && (
                <section>
                  <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-widest mb-3">
                    Hottest chain
                  </h2>
                  <FeaturedRelayCard
                    relay={data.hottest_relay}
                    title="Most active this week"
                    icon={Flame}
                    iconCls="text-against-400"
                  />
                </section>
              )}

              {/* ── Empty state when nothing happened this week ───────── */}
              {!data.featured_relay && !data.hottest_relay && data.stats.new_relays === 0 && (
                <div className="rounded-xl bg-surface-200/40 border border-surface-300/40 p-6 text-center space-y-3">
                  <GitMerge className="h-10 w-10 text-surface-500 mx-auto" />
                  <p className="text-sm text-surface-400">No relay activity yet this week.</p>
                  <Link
                    href="/relays/create"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple/80 border border-purple/50 text-white text-sm font-semibold hover:bg-purple transition-colors"
                  >
                    Start a relay chain
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}

              {/* ── Top legs (most starred) ───────────────────────────── */}
              {data.top_legs.length > 0 && (
                <section>
                  <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Star className="h-3.5 w-3.5 text-gold fill-gold" />
                    Top legs this week
                  </h2>
                  <div className="space-y-2">
                    {data.top_legs.map((leg, i) => (
                      <TopLegCard key={leg.id} leg={leg} rank={i + 1} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Top contributors ──────────────────────────────────── */}
              {data.top_contributors.length > 0 && (
                <section>
                  <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Award className="h-3.5 w-3.5 text-purple" />
                    Top contributors
                  </h2>
                  <div className="space-y-2">
                    {data.top_contributors.map((c, i) => (
                      <ContributorCard key={c.author_id} contributor={c} rank={i + 1} />
                    ))}
                  </div>
                  <Link
                    href="/relays/champions"
                    className="flex items-center justify-center gap-2 mt-3 py-2.5 rounded-xl bg-surface-200/50 border border-surface-300/40 text-xs text-surface-400 hover:text-white hover:border-surface-400/60 transition-all"
                  >
                    All-time champions <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </section>
              )}

              {/* ── Category breakdown ────────────────────────────────── */}
              {data.by_category.length > 0 && (
                <section>
                  <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <BarChart2 className="h-3.5 w-3.5 text-for-400" />
                    Activity by category
                  </h2>
                  <div className="rounded-xl bg-surface-200/50 border border-surface-300/40 p-4 space-y-3">
                    {data.by_category.map((stat) => (
                      <CategoryBar key={stat.category} stat={stat} maxRelays={maxCatRelays} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Join open relays CTA ──────────────────────────────── */}
              {data.open_relays_count > 0 && (
                <section>
                  <div className="rounded-xl bg-purple/10 border border-purple/25 p-4 flex items-center gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-purple/20 flex items-center justify-center">
                      <GitMerge className="h-5 w-5 text-purple" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">
                        {data.open_relays_count} relay{data.open_relays_count !== 1 ? 's' : ''} need your voice
                      </p>
                      <p className="text-xs text-surface-400">Open chains waiting for contributors</p>
                    </div>
                    <Link
                      href="/relays/uncontested"
                      className="flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl bg-purple/80 border border-purple/50 text-white text-xs font-semibold hover:bg-purple transition-colors"
                    >
                      Join <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </section>
              )}

              {/* ── Navigation links ──────────────────────────────────── */}
              <section>
                <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-widest mb-3">
                  Explore relays
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { href: '/relays', label: 'All Relays', icon: GitMerge },
                    { href: '/relays/pulse', label: 'Live Pulse', icon: Activity },
                    { href: '/relays/for-you', label: 'For You', icon: Zap },
                    { href: '/relays/hall-of-fame', label: 'Hall of Fame', icon: Trophy },
                    { href: '/relays/league', label: 'Weekly League', icon: Award },
                  ].map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2 p-3 rounded-xl bg-surface-200/50 border border-surface-300/40 hover:border-surface-400/60 text-sm text-surface-300 hover:text-white transition-all"
                    >
                      <Icon className="h-4 w-4 text-surface-500 flex-shrink-0" />
                      {label}
                    </Link>
                  ))}
                </div>
              </section>
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Loading indicator ───────────────────────────────────────── */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 text-surface-500 animate-spin" />
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
