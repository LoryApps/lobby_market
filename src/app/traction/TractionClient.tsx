'use client'

/**
 * /traction — The Civic Traction Index
 *
 * Shows debates that are actively BUILDING composite momentum right now.
 * Unlike /trending (raw popularity) or /groundswell (single-signal revival),
 * Traction combines three acceleration signals into one score:
 *
 *   • Vote velocity   (60%) — how many × above normal daily vote rate?
 *   • Argument burst  (30%) — arguments per day vs. 7-day baseline
 *   • New watchers    (10%) — topic subscriptions added in the last 24 h
 *
 * Tiers:
 *   Breakthrough  ≥70 — multi-signal acceleration, potential law candidate
 *   Surging       ≥45 — two or more signals firing simultaneously
 *   Building      ≥20 — single signal consistently above baseline
 *   Emerging      <20  — early traction, worth watching
 *
 * Distinct from:
 *   /trending    — algorithm-ranked feed score (absolute popularity)
 *   /groundswell — single-signal vote revival rate
 *   /surge       — high-volume topics (already loud)
 *   /momentum    — direction of vote-split shift (FOR vs. AGAINST)
 *   /rising      — recently proposed topics gaining early traction
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  BarChart2,
  BookOpen,
  Flame,
  MessageSquare,
  RefreshCw,
  Rocket,
  Star,
  TrendingUp,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TractionTopic, TractionResponse } from '@/app/api/topics/traction/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<TractionTopic['tier'], {
  label: string
  icon: typeof Rocket
  color: string
  bg: string
  border: string
  glow: string
}> = {
  breakthrough: {
    label: 'Breakthrough',
    icon:  Rocket,
    color:  'text-gold',
    bg:     'bg-gold/10',
    border: 'border-gold/40',
    glow:   'bg-gold/5',
  },
  surging: {
    label: 'Surging',
    icon:  Flame,
    color:  'text-against-400',
    bg:     'bg-against-500/10',
    border: 'border-against-500/40',
    glow:   'bg-against-500/5',
  },
  building: {
    label: 'Building',
    icon:  TrendingUp,
    color:  'text-for-400',
    bg:     'bg-for-500/10',
    border: 'border-for-500/40',
    glow:   'bg-for-500/5',
  },
  emerging: {
    label: 'Emerging',
    icon:  Zap,
    color:  'text-emerald',
    bg:     'bg-emerald/10',
    border: 'border-emerald/40',
    glow:   'bg-emerald/5',
  },
}

// ─── Category colours ─────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  Economics:   'text-gold        border-gold/40        bg-gold/10',
  Politics:    'text-for-400     border-for-500/40     bg-for-500/10',
  Technology:  'text-purple      border-purple/40      bg-purple/10',
  Science:     'text-emerald     border-emerald/40     bg-emerald/10',
  Ethics:      'text-amber-400   border-amber-500/40   bg-amber-500/10',
  Philosophy:  'text-purple      border-purple/40      bg-purple/10',
  Culture:     'text-against-400 border-against-500/40 bg-against-500/10',
  Health:      'text-emerald     border-emerald/40     bg-emerald/10',
  Environment: 'text-emerald     border-emerald/40     bg-emerald/10',
  Education:   'text-gold        border-gold/40        bg-gold/10',
}

function catClass(cat: string | null): string {
  return CAT_COLORS[cat ?? ''] ?? 'text-surface-500 border-surface-400 bg-surface-300/40'
}

// ─── Velocity badge ───────────────────────────────────────────────────────────

function VelocityBadge({
  label,
  icon: Icon,
  value,
  colorClass,
}: {
  label: string
  icon: typeof Vote
  value: number
  colorClass: string
}) {
  const formatted = value < 2 ? `${value.toFixed(1)}×` : `${Math.round(value)}×`
  return (
    <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-mono font-semibold', colorClass)}>
      <Icon className="w-3 h-3" />
      <span>{label}</span>
      <span className="opacity-70">{formatted}</span>
    </div>
  )
}

// ─── Traction bar ─────────────────────────────────────────────────────────────

function TractionBar({ score }: { score: number }) {
  const pct = Math.min(score, 100)
  const color =
    pct >= 70 ? 'bg-gold' :
    pct >= 45 ? 'bg-against-500' :
    pct >= 20 ? 'bg-for-500' :
               'bg-emerald'
  return (
    <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
      <motion.div
        className={cn('h-full rounded-full', color)}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function TractionCard({ topic, rank }: { topic: TractionTopic; rank: number }) {
  const tier   = TIER_CONFIG[topic.tier]
  const TierIcon = tier.icon
  const forPct = Math.round(topic.blue_pct)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: rank * 0.04 }}
    >
      <Link href={`/topic/${topic.id}`}>
        <div className={cn(
          'relative rounded-xl border p-4 transition-all cursor-pointer overflow-hidden',
          'bg-surface-200/60 hover:bg-surface-200 border-surface-300/60 hover:border-surface-400/60',
        )}>
          {/* Subtle glow behind top-tier cards */}
          {topic.tier === 'breakthrough' && (
            <div className="absolute inset-0 bg-gold/3 pointer-events-none rounded-xl" />
          )}

          {/* Header row */}
          <div className="flex items-start gap-3">
            {/* Rank */}
            <span className={cn(
              'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold font-mono mt-0.5',
              rank === 1 ? 'bg-gold/20 text-gold border border-gold/40' :
              rank === 2 ? 'bg-surface-400/40 text-surface-600 border border-surface-400/40' :
              rank === 3 ? 'bg-amber-900/30 text-amber-500 border border-amber-700/40' :
                           'bg-surface-300/40 text-surface-500 border border-surface-300/40',
            )}>
              {rank}
            </span>

            {/* Statement + meta */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white leading-snug line-clamp-2">
                {topic.statement}
              </p>

              {/* Category + status + scope row */}
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {topic.category && (
                  <span className={cn(
                    'text-[10px] font-semibold px-1.5 py-0.5 rounded border',
                    catClass(topic.category),
                  )}>
                    {topic.category}
                  </span>
                )}
                {topic.scope && (
                  <span className="text-[10px] text-surface-500 font-mono">
                    {topic.scope}
                  </span>
                )}
                <Badge variant={topic.status as 'proposed' | 'active' | 'law' | 'failed'} size="sm" />
              </div>
            </div>

            {/* Tier badge */}
            <div className={cn(
              'flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold',
              tier.bg, tier.border, tier.color,
            )}>
              <TierIcon className="w-3 h-3" />
              <span className="hidden sm:inline">{tier.label}</span>
            </div>
          </div>

          {/* Traction score bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-surface-500 font-mono uppercase tracking-wide">
                Traction Score
              </span>
              <span className={cn('text-[11px] font-bold font-mono', tier.color)}>
                {topic.traction_score}
              </span>
            </div>
            <TractionBar score={topic.traction_score} />
          </div>

          {/* Velocity signals */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <VelocityBadge
              label="Votes"
              icon={Vote}
              value={topic.vote_velocity}
              colorClass="text-for-300 border-for-500/30 bg-for-600/10"
            />
            {topic.arg_velocity > 0 && (
              <VelocityBadge
                label="Args"
                icon={MessageSquare}
                value={topic.arg_velocity}
                colorClass="text-purple border-purple/30 bg-purple/10"
              />
            )}
            {topic.sub_velocity > 0 && (
              <VelocityBadge
                label="Watch"
                icon={Star}
                value={topic.sub_velocity}
                colorClass="text-emerald border-emerald/30 bg-emerald/10"
              />
            )}

            {/* FOR/AGAINST bar */}
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-for-400">{forPct}%</span>
              <div className="w-16 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                <div
                  className="h-full bg-for-500 rounded-full"
                  style={{ width: `${forPct}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-against-400">{100 - forPct}%</span>
            </div>
          </div>

          <ArrowRight className="absolute right-4 top-4 w-3.5 h-3.5 text-surface-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function TractionCardSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300/60 bg-surface-200/40 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="w-6 h-6 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-2/5" />
        </div>
        <Skeleton className="w-20 h-6 rounded-lg flex-shrink-0" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-5 w-16 rounded-md" />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function TractionClient() {
  const [data, setData]       = useState<TractionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)
  const [filter, setFilter]   = useState<TractionTopic['tier'] | 'all'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/topics/traction')
      if (!res.ok) throw new Error('fetch')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = (data?.topics ?? []).filter(
    (t) => filter === 'all' || t.tier === filter,
  )

  const tierCounts: Record<string, number> = {}
  for (const t of data?.topics ?? []) {
    tierCounts[t.tier] = (tierCounts[t.tier] ?? 0) + 1
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-24">
        {/* ── Header ── */}
        <div className="py-6">
          <div className="flex items-center gap-2.5 mb-1">
            <Activity className="w-5 h-5 text-gold" />
            <h1 className="text-xl font-bold text-white tracking-tight">
              Civic Traction Index
            </h1>
          </div>
          <p className="text-sm text-surface-500 leading-relaxed">
            Debates gaining composite momentum — vote velocity, argument
            burst, and new watchers, combined into a single signal.
          </p>
        </div>

        {/* ── Tier filter bar ── */}
        {!loading && !error && (data?.topics?.length ?? 0) > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {([
              { id: 'all',          label: 'All',         count: data?.topics.length ?? 0  },
              { id: 'breakthrough', label: 'Breakthrough', count: tierCounts.breakthrough ?? 0 },
              { id: 'surging',      label: 'Surging',      count: tierCounts.surging      ?? 0 },
              { id: 'building',     label: 'Building',     count: tierCounts.building     ?? 0 },
              { id: 'emerging',     label: 'Emerging',     count: tierCounts.emerging     ?? 0 },
            ] as const).map(({ id, label, count }) => {
              if (id !== 'all' && count === 0) return null
              const active = filter === id
              return (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all',
                    active
                      ? id === 'breakthrough'
                        ? 'bg-gold/15 border-gold/50 text-gold'
                        : id === 'surging'
                          ? 'bg-against-500/15 border-against-500/50 text-against-400'
                          : id === 'building'
                            ? 'bg-for-500/15 border-for-500/50 text-for-400'
                            : id === 'emerging'
                              ? 'bg-emerald/15 border-emerald/50 text-emerald'
                              : 'bg-surface-300 border-surface-400 text-white'
                      : 'bg-transparent border-surface-400/50 text-surface-500 hover:text-white hover:border-surface-400',
                  )}
                >
                  {label}
                  <span className={cn(
                    'text-[10px] font-mono',
                    active ? 'opacity-80' : 'opacity-50',
                  )}>
                    {count}
                  </span>
                </button>
              )
            })}

            <button
              onClick={load}
              disabled={loading}
              aria-label="Refresh traction data"
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-surface-400/50 text-surface-500 hover:text-white hover:border-surface-400 text-xs font-semibold transition-all disabled:opacity-40"
            >
              <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        )}

        {/* ── Legend ── */}
        {!loading && !error && (data?.topics?.length ?? 0) > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
            {(['breakthrough', 'surging', 'building', 'emerging'] as const).map((tier) => {
              const cfg = TIER_CONFIG[tier]
              const TierIcon = cfg.icon
              return (
                <div
                  key={tier}
                  className={cn(
                    'flex items-center gap-2 p-2.5 rounded-lg border text-xs',
                    cfg.bg, cfg.border,
                  )}
                >
                  <TierIcon className={cn('w-3.5 h-3.5', cfg.color)} />
                  <div>
                    <p className={cn('font-semibold text-[11px]', cfg.color)}>
                      {cfg.label}
                    </p>
                    <p className="text-[10px] text-surface-500">
                      {tier === 'breakthrough' ? '≥70 score' :
                       tier === 'surging'      ? '≥45 score' :
                       tier === 'building'     ? '≥20 score' : '<20 score'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Content ── */}
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="skeletons"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <TractionCardSkeleton key={i} />
              ))}
            </motion.div>
          )}

          {!loading && error && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon={<Activity className="w-8 h-8 text-surface-500" />}
                title="Couldn't load traction data"
                description="Check back in a moment."
                action={{ label: 'Retry', onClick: load }}
              />
            </motion.div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon={<BarChart2 className="w-8 h-8 text-surface-500" />}
                title="No traction detected yet"
                description={
                  filter === 'all'
                    ? 'No debates are showing composite acceleration right now. Check back soon — traction builds fast.'
                    : `No ${filter} topics right now. Try a different tier filter.`
                }
                action={filter !== 'all' ? { label: 'Show all', onClick: () => setFilter('all') } : undefined}
              />
            </motion.div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {filtered.map((topic, i) => (
                <TractionCard key={topic.id} topic={topic} rank={i + 1} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Explainer ── */}
        {!loading && !error && (data?.topics?.length ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 rounded-xl border border-surface-300/60 bg-surface-200/40 p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-surface-500" />
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
                How Traction Is Calculated
              </p>
            </div>
            <div className="space-y-1.5 text-xs text-surface-500 leading-relaxed">
              <p>
                <span className="text-for-400 font-semibold">Vote velocity (60%)</span>{' '}
                — votes in the last 24 h divided by the 7-day daily average. A topic
                receiving 5× its usual votes scores highly here.
              </p>
              <p>
                <span className="text-purple font-semibold">Argument burst (30%)</span>{' '}
                — new arguments posted today vs. the prior 7-day baseline. Argument
                acceleration often precedes voting surges.
              </p>
              <p>
                <span className="text-emerald font-semibold">New watchers (10%)</span>{' '}
                — topic subscriptions added in the last 24 h vs. baseline. Rising
                watchlist adds signal growing civic interest.
              </p>
              <p className="text-surface-600 pt-1">
                Each signal is log-normalised to 0–100 and combined into a composite
                traction score. A score of 70+ across all three signals earns
                &ldquo;Breakthrough&rdquo; status.
              </p>
            </div>

            {data?.generated_at && (
              <p className="text-[10px] text-surface-600 mt-3 font-mono">
                Updated {new Date(data.generated_at).toLocaleTimeString()}
              </p>
            )}
          </motion.div>
        )}

        {/* ── Related tools ── */}
        <div className="mt-6 grid grid-cols-2 gap-2">
          {[
            { href: '/trending',    label: 'Trending',     icon: TrendingUp,   desc: 'Feed algorithm rank'    },
            { href: '/groundswell', label: 'Groundswell',  icon: Activity,     desc: 'Vote revival rate'      },
            { href: '/surge',       label: 'Surge',        icon: Zap,          desc: 'Absolute high-volume'   },
            { href: '/momentum',    label: 'Momentum',     icon: Flame,        desc: 'Vote direction shifts'  },
          ].map(({ href, label, icon: Icon, desc }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 p-3 rounded-xl border border-surface-300/60 bg-surface-200/40 hover:bg-surface-200 hover:border-surface-400/60 transition-all group"
            >
              <Icon className="w-4 h-4 text-surface-500 group-hover:text-white transition-colors" />
              <div>
                <p className="text-xs font-semibold text-surface-400 group-hover:text-white transition-colors">
                  {label}
                </p>
                <p className="text-[10px] text-surface-600">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
