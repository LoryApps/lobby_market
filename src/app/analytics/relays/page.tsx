'use client'

/**
 * /analytics/relays — Relay Chain Analytics
 *
 * Personal breakdown of all relay contributions:
 *   - Total legs authored, relays started, relays participated in
 *   - Upvotes received (total + per-leg average)
 *   - Compelling rate for relays you started
 *   - Archetype: Anchor, Relay Builder, Finisher, Chain Link, Catalyst, Newcomer
 *   - Category breakdown (which topics you relay on most)
 *   - Side distribution (FOR vs AGAINST)
 *   - Leg position heat bar (which slot you typically fill)
 *   - Monthly activity trend
 *   - Recent contributions list
 *
 * Distinct from:
 *   /relays           — browse all relay chains
 *   /relays/mine      — relays you started or contributed to
 *   /relays/champions — platform-wide top relay contributors
 *   /analytics        — overall civic stats hub
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Flame,
  GitMerge,
  RefreshCw,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  RelayAnalyticsResponse,
  RelayLegRecord,
  RelayArchetype,
} from '@/app/api/analytics/relays/route'

// ─── Archetype config ──────────────────────────────────────────────────────────

const ARCHETYPE_CONFIG: Record<
  RelayArchetype,
  {
    label: string
    description: string
    icon: typeof Trophy
    color: string
    bg: string
    border: string
  }
> = {
  newcomer: {
    label: 'The Newcomer',
    description: 'Just getting started with relay chains. Contribute to at least 3 relays to unlock your relay archetype.',
    icon: GitMerge,
    color: 'text-surface-400',
    bg: 'bg-surface-300/10',
    border: 'border-surface-300/20',
  },
  relay_builder: {
    label: 'The Relay Builder',
    description: 'You frequently start relay chains, setting the tone and direction for the collective argument.',
    icon: Sparkles,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
  },
  chain_link: {
    label: 'The Chain Link',
    description: 'You excel at connecting arguments mid-chain, keeping the reasoning tight and building on what came before.',
    icon: GitMerge,
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
  },
  finisher: {
    label: 'The Finisher',
    description: 'You often step in to close out relay chains with a decisive final argument. The crowd-closer.',
    icon: Flame,
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
  },
  anchor: {
    label: 'The Anchor',
    description: 'Your relay legs consistently earn the most stars. The community trusts your reasoning quality.',
    icon: Star,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
  },
  catalyst: {
    label: 'The Catalyst',
    description: 'You contribute across many topic categories — a civic generalist sparking debate everywhere.',
    icon: Zap,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
  },
}

// ─── Category colours (matching the rest of the platform) ────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'bg-gold',
  Politics: 'bg-for-500',
  Technology: 'bg-purple',
  Science: 'bg-emerald',
  Ethics: 'bg-for-300',
  Philosophy: 'bg-purple',
  Culture: 'bg-against-400',
  Health: 'bg-emerald',
  Environment: 'bg-emerald',
  Education: 'bg-gold',
}

function catColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? 'bg-surface-400'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: number | string
  sub?: string
  icon: typeof Trophy
  color: string
}) {
  return (
    <div className="bg-surface-100 border border-surface-300/60 rounded-xl p-4 flex flex-col gap-1">
      <div className={cn('flex items-center gap-1.5 text-xs font-medium', color)}>
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold text-white mt-0.5">
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </div>
      {sub && <div className="text-[11px] text-surface-500 font-mono">{sub}</div>}
    </div>
  )
}

function LegRow({ leg }: { leg: RelayLegRecord }) {
  const statusCls =
    leg.relay_status === 'voted'
      ? 'text-surface-500'
      : leg.relay_status === 'complete'
      ? 'text-for-400'
      : leg.relay_status === 'in_progress'
      ? 'text-gold'
      : 'text-emerald'

  return (
    <Link
      href={`/relays/${leg.relay_id}`}
      className="block p-4 rounded-xl bg-surface-100/80 border border-surface-300/60 hover:border-surface-400/60 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-offset-2 ring-offset-surface-100',
            leg.side === 'for'
              ? 'bg-for-600/30 text-for-300 ring-for-600/30'
              : 'bg-against-600/30 text-against-300 ring-against-600/30',
          )}
        >
          #{leg.leg_number}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/90 line-clamp-2 leading-snug">{leg.content}</p>
          {leg.topic_statement && (
            <p className="text-[11px] text-surface-500 mt-1 truncate">
              {leg.topic_statement}
            </p>
          )}
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1.5">
          {leg.upvote_count > 0 && (
            <span className="flex items-center gap-0.5 text-gold text-xs font-bold">
              <Star className="w-3 h-3 fill-gold" />
              {leg.upvote_count}
            </span>
          )}
          <span className={cn('text-[10px] font-mono capitalize', statusCls)}>
            {leg.relay_status === 'in_progress' ? 'in progress' : leg.relay_status}
          </span>
          <span className="text-[10px] text-surface-600 font-mono">
            {relDate(leg.created_at)}
          </span>
        </div>
      </div>

      {leg.relay_compelling_pct !== null && leg.relay_status === 'voted' && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className="flex-1 h-1 bg-surface-300 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full', leg.relay_compelling_pct >= 50 ? 'bg-for-500' : 'bg-against-500')}
              style={{ width: `${leg.relay_compelling_pct}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-surface-500">
            {leg.relay_compelling_pct}% compelling
          </span>
        </div>
      )}
    </Link>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RelayAnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<RelayAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/relays')
      if (res.status === 401) { router.replace('/login'); return }
      if (!res.ok) throw new Error('Failed to load relay analytics')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const archConfig = data ? ARCHETYPE_CONFIG[data.archetype] : null
  const ArchIcon = archConfig?.icon ?? GitMerge

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <GitMerge className="w-5 h-5 text-purple" />
              Relay Analytics
            </h1>
            <p className="text-sm text-surface-500">Your civic relay chain performance</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl bg-against-500/10 border border-against-500/30 text-against-300 text-sm">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        )}

        {/* Content */}
        {data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Legs Written"
                  value={data.total_legs}
                  sub="total contributions"
                  icon={GitMerge}
                  color="text-purple"
                />
                <StatCard
                  label="Relays Started"
                  value={data.relays_started}
                  sub={`${data.relays_participated} participated`}
                  icon={Sparkles}
                  color="text-for-300"
                />
                <StatCard
                  label="Stars Earned"
                  value={data.total_upvotes_received}
                  sub={`avg ${data.avg_upvotes_per_leg} per leg`}
                  icon={Star}
                  color="text-gold"
                />
                <StatCard
                  label="Compelling Rate"
                  value={data.compelling_rate !== null ? `${data.compelling_rate}%` : '—'}
                  sub={data.compelling_rate !== null ? 'of your relays' : 'need more data'}
                  icon={Trophy}
                  color="text-emerald"
                />
              </div>

              {/* Archetype card */}
              {archConfig && (
                <div className={cn(
                  'rounded-2xl border p-5 flex items-start gap-4',
                  archConfig.bg,
                  archConfig.border,
                )}>
                  <div className={cn(
                    'shrink-0 w-12 h-12 rounded-xl flex items-center justify-center',
                    archConfig.bg,
                    'border',
                    archConfig.border,
                  )}>
                    <ArchIcon className={cn('w-6 h-6', archConfig.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-0.5">
                      Relay Archetype
                    </p>
                    <p className={cn('text-lg font-bold', archConfig.color)}>
                      {data.archetype_label}
                    </p>
                    <p className="text-sm text-surface-400 mt-1 leading-relaxed">
                      {archConfig.description}
                    </p>
                  </div>
                </div>
              )}

              {/* Side distribution */}
              {data.total_legs > 0 && (
                <div className="bg-surface-100 border border-surface-300/60 rounded-xl p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                    Position Alignment
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <ThumbsUp className="w-3.5 h-3.5 text-for-400 shrink-0" />
                      <div className="flex-1 h-2 bg-surface-300 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-for-500 rounded-full transition-all"
                          style={{
                            width: `${data.total_legs > 0 ? (data.side_breakdown.for / data.total_legs) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono text-for-300 w-8 text-right">
                        {data.side_breakdown.for}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ThumbsDown className="w-3.5 h-3.5 text-against-400 shrink-0" />
                      <div className="flex-1 h-2 bg-surface-300 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-against-500 rounded-full transition-all"
                          style={{
                            width: `${data.total_legs > 0 ? (data.side_breakdown.against / data.total_legs) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono text-against-300 w-8 text-right">
                        {data.side_breakdown.against}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] text-surface-600 font-mono">
                    <span>FOR ({Math.round(data.total_legs > 0 ? (data.side_breakdown.for / data.total_legs) * 100 : 0)}%)</span>
                    <span>AGAINST ({Math.round(data.total_legs > 0 ? (data.side_breakdown.against / data.total_legs) * 100 : 0)}%)</span>
                  </div>
                </div>
              )}

              {/* Leg position heatbar */}
              {data.total_legs > 0 && (
                <div className="bg-surface-100 border border-surface-300/60 rounded-xl p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                    Which Leg Do You Fill?
                  </h3>
                  <div className="flex gap-2">
                    {data.leg_position_breakdown.map(({ position, count }) => {
                      const maxCount = Math.max(...data.leg_position_breakdown.map((p) => p.count), 1)
                      const intensity = count / maxCount
                      return (
                        <div key={position} className="flex-1 flex flex-col items-center gap-1.5">
                          <div
                            className={cn(
                              'w-full rounded-md transition-all',
                              intensity > 0
                                ? 'bg-purple'
                                : 'bg-surface-300',
                            )}
                            style={{
                              height: `${Math.max(4, intensity * 48)}px`,
                              opacity: intensity > 0 ? 0.3 + intensity * 0.7 : 1,
                            }}
                          />
                          <span className="text-[11px] font-mono text-surface-500">
                            #{position}
                          </span>
                          <span className="text-[10px] font-mono text-surface-600">
                            {count}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-[11px] text-surface-600">
                    Each bar shows how often you&apos;ve contributed in that chain position
                  </p>
                </div>
              )}

              {/* Category breakdown */}
              {data.category_breakdown.length > 0 && (
                <div className="bg-surface-100 border border-surface-300/60 rounded-xl p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                    Topics You Relay On
                  </h3>
                  <div className="space-y-2">
                    {data.category_breakdown.map(({ category, count, avg_upvotes }) => {
                      const maxCount = Math.max(...data.category_breakdown.map((c) => c.count), 1)
                      return (
                        <div key={category} className="flex items-center gap-2.5">
                          <span className="text-xs text-surface-400 w-24 truncate shrink-0">
                            {category}
                          </span>
                          <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                            <div
                              className={cn('h-full rounded-full', catColor(category))}
                              style={{ width: `${(count / maxCount) * 100}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono text-surface-500 w-6 text-right shrink-0">
                            {count}
                          </span>
                          {avg_upvotes > 0 && (
                            <span className="text-[10px] font-mono text-gold flex items-center gap-0.5 w-10 shrink-0">
                              <Star className="w-2.5 h-2.5 fill-gold" />
                              {avg_upvotes}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Best leg */}
              {data.best_leg_content && data.best_leg_upvotes > 0 && (
                <div className="bg-gold/5 border border-gold/20 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-gold fill-gold" />
                    <span className="text-xs font-semibold text-gold uppercase tracking-wider">
                      Your Most-Starred Leg
                    </span>
                    <span className="ml-auto text-xs font-bold text-gold">
                      {data.best_leg_upvotes} star{data.best_leg_upvotes !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {data.best_leg_topic && (
                    <p className="text-[11px] text-surface-500 truncate">
                      {data.best_leg_topic}
                    </p>
                  )}
                  <p className="text-sm text-white/90 leading-relaxed line-clamp-3">
                    &ldquo;{data.best_leg_content}&rdquo;
                  </p>
                </div>
              )}

              {/* Monthly activity */}
              {data.monthly_activity.length > 0 && (
                <div className="bg-surface-100 border border-surface-300/60 rounded-xl p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                    Monthly Activity
                  </h3>
                  <div className="flex items-end gap-1.5 h-16">
                    {data.monthly_activity.map(({ month, legs: legCount }) => {
                      const maxLegs = Math.max(...data.monthly_activity.map((m) => m.legs), 1)
                      const heightPct = (legCount / maxLegs) * 100
                      return (
                        <div key={month} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-full rounded-sm bg-purple/60 hover:bg-purple transition-colors"
                            style={{ height: `${Math.max(4, heightPct * 0.48)}px` }}
                            title={`${month}: ${legCount} leg${legCount !== 1 ? 's' : ''}`}
                          />
                          <span className="text-[9px] font-mono text-surface-600 w-full text-center truncate">
                            {month.slice(5)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Recent contributions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                    Recent Relay Legs
                  </h3>
                  <Link
                    href="/relays/mine"
                    className="text-xs text-purple hover:text-purple/80 flex items-center gap-1 transition-colors"
                  >
                    View all <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                {data.recent_legs.length === 0 ? (
                  <EmptyState
                    icon={GitMerge}
                    title="No relay contributions yet"
                    description="Join a relay chain to start building collaborative civic arguments."
                    action={{ label: 'Browse Relays', href: '/relays' }}
                  />
                ) : (
                  <div className="space-y-2">
                    {data.recent_legs.map((leg) => (
                      <LegRow key={leg.leg_id} leg={leg} />
                    ))}
                  </div>
                )}
              </div>

              {/* CTA to explore relays */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-purple/5 border border-purple/20">
                <GitMerge className="w-5 h-5 text-purple shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">Build more relay chains</p>
                  <p className="text-xs text-surface-500">Join open relays or start a new chain on a topic you care about.</p>
                </div>
                <Link
                  href="/relays"
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple/80 hover:bg-purple text-white text-xs font-semibold transition-colors"
                >
                  Explore <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
