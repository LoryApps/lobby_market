'use client'

/**
 * /relays/stats — Civic Relay Platform Analytics
 *
 * Platform-wide statistics for the Civic Relay system:
 *   • Headline metrics — total, completion rate, compelling rate, participants
 *   • Side distribution — FOR vs AGAINST relay breakdown
 *   • Category heatmap — which topics attract the most relays
 *   • Weekly activity chart — relays created vs completed over 8 weeks
 *   • Top relays — highest-scoring completed relays
 *
 * Distinct from:
 *   /leaderboard/relay  — ranks individual users by relay contributions
 *   /relays             — browse and join active relays
 *   /relays/[id]        — individual relay detail
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  GitMerge,
  RefreshCw,
  Sparkles,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { RelayStatsResponse, TopRelay, WeekPoint, CategoryStat } from '@/app/api/relays/stats/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Politics:    'bg-for-500',
  Economics:   'bg-gold',
  Technology:  'bg-purple',
  Science:     'bg-emerald',
  Philosophy:  'bg-against-500',
  Ethics:      'bg-amber-500',
  Society:     'bg-blue-400',
  Environment: 'bg-green-500',
  Health:      'bg-rose-400',
  Education:   'bg-indigo-400',
  'No Topic':  'bg-surface-400',
  Other:       'bg-surface-400',
}

function categoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? 'bg-surface-400'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-8 w-20 mb-1" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 h-56">
          <Skeleton className="h-4 w-24 mb-4" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-5 w-full mb-2" />
          ))}
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 h-56">
          <Skeleton className="h-4 w-24 mb-4" />
          <div className="flex items-end gap-1 h-32">
            {[40, 60, 30, 80, 50, 70, 45, 90].map((h, i) => (
              <Skeleton key={i} className="flex-1 rounded" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
    >
      <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={cn('text-2xl font-mono font-bold', accent ?? 'text-white')}>{value}</p>
      {sub && <p className="text-xs text-surface-500 mt-1">{sub}</p>}
    </motion.div>
  )
}

// ─── Weekly bar chart ─────────────────────────────────────────────────────────

function WeeklyChart({ weeks }: { weeks: WeekPoint[] }) {
  const maxVal = Math.max(...weeks.map((w) => Math.max(w.created, w.completed)), 1)

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
      <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
        Weekly Activity
      </p>
      <div className="flex items-end gap-1 h-28">
        {weeks.map((w, i) => (
          <div key={w.week} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="w-full flex flex-col-reverse gap-0.5" style={{ height: '100px' }}>
              <div
                className="w-full rounded-t-sm bg-for-500/70 transition-all"
                style={{ height: `${(w.created / maxVal) * 100}%` }}
                title={`${w.created} created`}
              />
            </div>
            <div
              className="w-full rounded-t-sm bg-emerald/70 transition-all"
              style={{ height: `${(w.completed / maxVal) * 60}px` }}
              title={`${w.completed} completed`}
            />
            <p className="text-[8px] font-mono text-surface-600 mt-1 truncate w-full text-center">
              {i % 2 === 0 ? w.label : ''}
            </p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3">
        <span className="flex items-center gap-1.5 text-xs text-surface-500">
          <span className="h-2 w-2 rounded-sm bg-for-500/70" />
          Created
        </span>
        <span className="flex items-center gap-1.5 text-xs text-surface-500">
          <span className="h-2 w-2 rounded-sm bg-emerald/70" />
          Completed
        </span>
      </div>
    </div>
  )
}

// ─── Category breakdown ───────────────────────────────────────────────────────

function CategoryBreakdown({ cats }: { cats: CategoryStat[] }) {
  const maxCount = Math.max(...cats.map((c) => c.count), 1)

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
      <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
        By Category
      </p>
      <div className="space-y-3">
        {cats.slice(0, 8).map((cat) => (
          <div key={cat.category}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono text-surface-400">{cat.category}</span>
              <div className="flex items-center gap-2 text-xs font-mono text-surface-500">
                <span className="text-white font-semibold">{cat.count}</span>
                {cat.completion_rate > 0 && (
                  <span className="text-emerald">{cat.completion_rate}% done</span>
                )}
              </div>
            </div>
            <div className="relative h-2 bg-surface-300 rounded-full overflow-hidden">
              <div
                className={cn('absolute inset-y-0 left-0 rounded-full transition-all', categoryColor(cat.category))}
                style={{ width: `${(cat.count / maxCount) * 100}%` }}
              />
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[10px] font-mono text-for-400">
                {cat.for_count} FOR
              </span>
              <span className="text-[10px] font-mono text-against-400">
                {cat.against_count} AGAINST
              </span>
              {cat.compelling_rate > 0 && (
                <span className="text-[10px] font-mono text-gold">
                  {cat.compelling_rate}% compelling
                </span>
              )}
            </div>
          </div>
        ))}
        {cats.length === 0 && (
          <p className="text-xs text-surface-600 text-center py-4">No relay data yet</p>
        )}
      </div>
    </div>
  )
}

// ─── Side distribution ────────────────────────────────────────────────────────

function SideDistribution({ forRelays, againstRelays }: { forRelays: number; againstRelays: number }) {
  const total = forRelays + againstRelays
  const forPct = total > 0 ? Math.round((forRelays / total) * 100) : 50
  const againstPct = 100 - forPct

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
      <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
        FOR vs AGAINST
      </p>
      <div className="h-5 rounded-full overflow-hidden flex">
        <div
          className="bg-for-500 transition-all"
          style={{ width: `${forPct}%` }}
        />
        <div
          className="bg-against-500 transition-all flex-1"
        />
      </div>
      <div className="flex items-center justify-between mt-3">
        <div>
          <p className="text-xl font-mono font-bold text-for-400">{forPct}%</p>
          <p className="text-xs font-mono text-surface-500">{forRelays} FOR relays</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-mono font-bold text-against-400">{againstPct}%</p>
          <p className="text-xs font-mono text-surface-500">{againstRelays} AGAINST relays</p>
        </div>
      </div>
    </div>
  )
}

// ─── Top relay card ───────────────────────────────────────────────────────────

function TopRelayCard({ relay, rank }: { relay: TopRelay; rank: number }) {
  const total = relay.vote_compelling + relay.vote_not_compelling
  const compellingPct = total > 0 ? Math.round((relay.vote_compelling / total) * 100) : 0
  const isFor = relay.side === 'for'

  return (
    <Link href={`/relays/${relay.id}`} className="block group">
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: rank * 0.05 }}
        className="flex items-start gap-3 p-4 rounded-xl bg-surface-200/50 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-all"
      >
        <div className={cn(
          'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold mt-0.5',
          rank === 1 ? 'bg-gold/20 text-gold' :
          rank === 2 ? 'bg-surface-300 text-surface-400' :
          rank === 3 ? 'bg-amber-600/20 text-amber-600' :
          'bg-surface-300/50 text-surface-500'
        )}>
          {rank}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={cn(
              'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase',
              isFor ? 'bg-for-500/15 text-for-400' : 'bg-against-500/15 text-against-400'
            )}>
              {isFor ? 'FOR' : 'AGAINST'}
            </span>
            {relay.topic_category && (
              <span className="text-[10px] font-mono text-surface-500">{relay.topic_category}</span>
            )}
          </div>

          {relay.topic_statement ? (
            <p className="text-sm text-white leading-snug line-clamp-2">
              {relay.topic_statement}
            </p>
          ) : (
            <p className="text-sm text-surface-400 italic">Free-form relay</p>
          )}

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-surface-500">
              <Avatar
                src={relay.starter_avatar_url}
                username={relay.starter_username}
                size="xs"
              />
              <span>{relay.starter_display_name ?? relay.starter_username}</span>
            </div>
            <span className="text-[10px] font-mono text-surface-600">
              {relay.legs_filled}/{relay.max_legs} legs
            </span>
            {total > 0 && (
              <div className="flex items-center gap-1">
                <ThumbsUp className="h-3 w-3 text-emerald" />
                <span className="text-[10px] font-mono text-emerald">{compellingPct}%</span>
                <span className="text-[10px] font-mono text-surface-600">
                  ({relay.vote_compelling}/{total} votes)
                </span>
              </div>
            )}
          </div>
        </div>

        <ArrowRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 flex-shrink-0 mt-1 transition-colors" />
      </motion.div>
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RelayStatsPage() {
  const [data, setData] = useState<RelayStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/relays/stats', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load stats')
      const json = await res.json() as RelayStatsResponse
      setData(json)
    } catch {
      setError('Could not load relay stats. Try refreshing.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const t = data?.totals

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/relays"
            className="flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Relays
          </Link>
          <span className="text-surface-600">/</span>
          <span className="text-sm font-mono text-surface-500">Stats</span>
        </div>

        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart2 className="h-5 w-5 text-for-400" aria-hidden="true" />
              <h1 className="font-mono text-xl font-bold text-white">Relay Analytics</h1>
            </div>
            <p className="text-sm text-surface-500">
              Platform-wide stats for the Civic Relay system — collaborative argument chains
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-all disabled:opacity-40"
            aria-label="Refresh stats"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-against-500/30 bg-against-500/10 px-4 py-3 mb-6">
            <p className="text-sm text-against-400">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && <StatsSkeleton />}

        {/* Content */}
        {!loading && data && (
          <div className="space-y-6">
            {/* Headline stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                label="Total Relays"
                value={(t?.total ?? 0).toLocaleString()}
                sub={`${t?.unique_participants ?? 0} participants`}
              />
              <StatCard
                label="Completion Rate"
                value={`${t?.completion_rate ?? 0}%`}
                sub={`${(t?.complete ?? 0) + (t?.voted ?? 0)} completed`}
                accent="text-emerald"
              />
              <StatCard
                label="Compelling Rate"
                value={`${t?.compelling_rate ?? 0}%`}
                sub={`of voted relays`}
                accent="text-gold"
              />
              <StatCard
                label="Avg Legs / Relay"
                value={t?.avg_legs_per_relay ?? 0}
                sub={`${(t?.total_legs ?? 0).toLocaleString()} total legs`}
                accent="text-purple"
              />
            </div>

            {/* Status breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
            >
              <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                Status Breakdown
              </p>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Open', value: t?.open ?? 0, color: 'text-emerald', bg: 'bg-emerald/10 border-emerald/20', icon: GitMerge },
                  { label: 'In Progress', value: t?.in_progress ?? 0, color: 'text-gold', bg: 'bg-gold/10 border-gold/20', icon: Zap },
                  { label: 'Complete', value: t?.complete ?? 0, color: 'text-for-400', bg: 'bg-for-500/10 border-for-500/20', icon: CheckCircle2 },
                  { label: 'Voted', value: t?.voted ?? 0, color: 'text-purple', bg: 'bg-purple/10 border-purple/20', icon: Trophy },
                ].map(({ label, value, color, bg, icon: Icon }) => (
                  <div key={label} className={cn('rounded-xl border p-3 text-center', bg)}>
                    <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} aria-hidden="true" />
                    <p className={cn('text-lg font-mono font-bold', color)}>{value}</p>
                    <p className="text-[10px] font-mono text-surface-500">{label}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Side distribution + weekly chart */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <SideDistribution
                  forRelays={t?.for_relays ?? 0}
                  againstRelays={t?.against_relays ?? 0}
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <WeeklyChart weeks={data.by_week} />
              </motion.div>
            </div>

            {/* Category breakdown */}
            {data.by_category.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <CategoryBreakdown cats={data.by_category} />
              </motion.div>
            )}

            {/* Top relays */}
            {data.top_relays.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">
                    Top Relays
                  </p>
                  <Link
                    href="/relays"
                    className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    <span>Browse all</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="space-y-2">
                  {data.top_relays.map((relay, i) => (
                    <TopRelayCard key={relay.id} relay={relay} rank={i + 1} />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Empty state */}
            {data.totals.total === 0 && (
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-12 text-center">
                <GitMerge className="h-10 w-10 text-surface-600 mx-auto mb-3" aria-hidden="true" />
                <h3 className="text-sm font-mono font-semibold text-surface-400 mb-1">No relays yet</h3>
                <p className="text-xs text-surface-600 mb-4">Start the first collaborative argument chain.</p>
                <Link
                  href="/relays/create"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-500 text-white text-xs font-mono font-semibold hover:bg-for-400 transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Start a Relay
                </Link>
              </div>
            )}

            {/* CTA */}
            {data.totals.total > 0 && (
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/relays"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-all"
                >
                  <GitMerge className="h-4 w-4" />
                  Browse Relays
                </Link>
                <Link
                  href="/relays/network"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-all"
                >
                  <Users className="h-4 w-4" />
                  Network
                </Link>
                <Link
                  href="/leaderboard/relay"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-all"
                >
                  <Users className="h-4 w-4" />
                  Leaderboard
                </Link>
                <Link
                  href="/relays/create"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-for-500/20 border border-for-500/30 text-sm font-mono text-for-400 hover:bg-for-500/30 transition-all"
                >
                  <Sparkles className="h-4 w-4" />
                  Start a Relay
                </Link>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
