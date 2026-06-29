'use client'

/**
 * /topic/[id]/pressure — Social Pressure Analysis
 *
 * Shows whether platform elites (high-clout users) diverge from the masses,
 * which side has recent vote momentum, how clout-weighting shifts consensus,
 * and who the most influential voices are on each side.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Crown,
  Flame,
  Info,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
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
  PressureResponse,
  PressureRoleBreakdown,
  PressureTopInfluencer,
} from '@/app/api/topics/[id]/pressure/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function pctBar(forPct: number, heightClass = 'h-2') {
  return (
    <div className={cn('w-full rounded-full bg-surface-200 overflow-hidden', heightClass)}>
      <div
        className="h-full bg-gradient-to-r from-for-600 to-for-400 transition-all duration-700"
        style={{ width: `${forPct}%` }}
      />
    </div>
  )
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  proposed: { label: 'Proposed', color: 'text-surface-500' },
  active:   { label: 'Active',   color: 'text-for-400' },
  voting:   { label: 'Voting',   color: 'text-purple' },
  law:      { label: 'LAW',      color: 'text-gold' },
  failed:   { label: 'Failed',   color: 'text-surface-500' },
}

const ROLE_COLOR: Record<string, string> = {
  elder:         'text-gold',
  senator:       'text-purple',
  lawmaker:      'text-gold',
  troll_catcher: 'text-emerald',
  debator:       'text-for-300',
  person:        'text-surface-500',
}

const DIVERGENCE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  none:     { label: 'No Divergence',       color: 'text-surface-400',  bg: 'bg-surface-200',     border: 'border-surface-300'   },
  mild:     { label: 'Mild Divergence',     color: 'text-gold',          bg: 'bg-gold/10',         border: 'border-gold/30'       },
  moderate: { label: 'Moderate Divergence', color: 'text-purple',        bg: 'bg-purple/10',       border: 'border-purple/30'     },
  strong:   { label: 'Strong Divergence',   color: 'text-against-400',   bg: 'bg-against-500/10',  border: 'border-against-500/30' },
}

// ─── Role bar ──────────────────────────────────────────────────────────────────

function RoleBar({ role }: { role: PressureRoleBreakdown }) {
  const colorClass = ROLE_COLOR[role.role] ?? 'text-surface-400'
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-xs font-mono font-semibold', colorClass)}>
          {role.label}
        </span>
        <span className="text-[10px] font-mono text-surface-500">
          {fmt(role.total)} vote{role.total !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-full h-2 rounded-full bg-surface-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-for-600 to-for-400 transition-all duration-500"
            style={{ width: `${role.forPct}%` }}
          />
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 min-w-[80px] justify-end">
          <span className="text-[11px] font-mono text-for-400">{role.forPct}%</span>
          <span className="text-[10px] font-mono text-surface-600">/</span>
          <span className="text-[11px] font-mono text-against-400">{100 - role.forPct}%</span>
        </div>
      </div>
    </div>
  )
}

// ─── Influencer pill ──────────────────────────────────────────────────────────

function InfluencerRow({ inf }: { inf: PressureTopInfluencer }) {
  const colorClass = ROLE_COLOR[inf.role] ?? 'text-surface-400'
  const isFor = inf.side === 'for'
  return (
    <div className="flex items-center gap-3 py-2 border-b border-surface-300/50 last:border-0">
      <Link href={`/profile/${inf.username}`} className="flex-shrink-0">
        <Avatar src={inf.avatar_url} fallback={inf.display_name || inf.username} size="sm" />
      </Link>
      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${inf.username}`}
          className="text-xs font-mono font-semibold text-white hover:text-for-300 transition-colors truncate block"
        >
          {inf.display_name || inf.username}
        </Link>
        <span className={cn('text-[10px] font-mono', colorClass)}>
          {inf.role === 'elder' ? 'Elder' :
           inf.role === 'troll_catcher' ? 'Troll Catcher' :
           inf.role === 'debator' ? 'Debator' : 'Citizen'}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[10px] font-mono text-surface-500">
          {fmt(inf.clout)} clout
        </span>
        <div
          className={cn(
            'flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold',
            isFor
              ? 'bg-for-600/20 text-for-300 border border-for-600/30'
              : 'bg-against-600/20 text-against-300 border border-against-600/30'
          )}
        >
          {isFor ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
          <span>{isFor ? 'FOR' : 'AGT'}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PressureSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-2/3" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function PressureClient() {
  const { id: topicId } = useParams<{ id: string }>()
  const [data, setData] = useState<PressureResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/pressure`)
      if (!res.ok) throw new Error('Failed to load pressure data')
      const json = await res.json() as PressureResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => {
    load()
  }, [load])

  const statusCfg = STATUS_CONFIG[data?.status ?? ''] ?? STATUS_CONFIG.proposed
  const divCfg = DIVERGENCE_CONFIG[data?.divergenceLevel ?? 'none']

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-5 pb-24 md:pb-12">

        {/* Back nav */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href={`/topic/${topicId}`}
            className="flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to debate
          </Link>
          {data && (
            <>
              <span className="text-surface-600">/</span>
              <span className={cn('text-xs font-mono font-semibold', statusCfg.color)}>
                {statusCfg.label}
              </span>
            </>
          )}
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 className="h-5 w-5 text-purple" />
            <h1 className="text-lg font-mono font-bold text-white">Pressure Analysis</h1>
          </div>
          {data && (
            <p className="text-sm font-mono text-surface-400 leading-relaxed line-clamp-2">
              {data.statement}
            </p>
          )}
        </div>

        {loading && (
          <PressureSkeleton />
        )}

        {error && (
          <EmptyState
            icon={Scale}
            title="Could not load pressure data"
            description={error}
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {!loading && !error && data && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >

            {/* Quick stats row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {/* Raw consensus */}
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-1">
                  Raw Consensus
                </p>
                <p className="text-2xl font-mono font-bold text-for-300">
                  {data.rawForPct}%
                </p>
                <p className="text-[10px] font-mono text-surface-500 mt-0.5">FOR</p>
              </div>

              {/* Clout-weighted */}
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-1">
                  Clout-Weighted
                </p>
                <p className={cn(
                  'text-2xl font-mono font-bold',
                  data.cloutWeighted.weightedForPct > data.rawForPct ? 'text-for-300' : 'text-against-300'
                )}>
                  {data.cloutWeighted.weightedForPct}%
                </p>
                <p className="text-[10px] font-mono text-surface-500 mt-0.5">
                  {data.cloutWeighted.eliteInfluenceDelta > 0 ? '+' : ''}{data.cloutWeighted.eliteInfluenceDelta}pp shift
                </p>
              </div>

              {/* Recent momentum */}
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-1">
                  Last 7 Days
                </p>
                <p className={cn(
                  'text-2xl font-mono font-bold',
                  data.momentum.recentForPct >= 50 ? 'text-for-300' : 'text-against-300'
                )}>
                  {data.momentum.recentTotal > 0 ? `${data.momentum.recentForPct}%` : '—'}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  {data.momentum.momentumShift > 0 ? (
                    <TrendingUp className="h-3 w-3 text-for-400" />
                  ) : data.momentum.momentumShift < 0 ? (
                    <TrendingDown className="h-3 w-3 text-against-400" />
                  ) : null}
                  <p className="text-[10px] font-mono text-surface-500">
                    {data.momentum.recentTotal > 0
                      ? `${data.momentum.momentumShift > 0 ? '+' : ''}${data.momentum.momentumShift}pp`
                      : 'No data'}
                  </p>
                </div>
              </div>

              {/* Total votes */}
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-1">
                  Total Votes
                </p>
                <p className="text-2xl font-mono font-bold text-white">
                  {fmt(data.totalVotes)}
                </p>
                <p className="text-[10px] font-mono text-surface-500 mt-0.5">cast</p>
              </div>
            </div>

            {/* Elite vs Grassroots */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-gold" />
                  <h2 className="text-sm font-mono font-bold text-white">
                    Elite vs Grassroots
                  </h2>
                </div>
                <div className={cn(
                  'flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                  divCfg.color, divCfg.bg, divCfg.border
                )}>
                  {divCfg.label}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Elite */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Crown className="h-3 w-3 text-gold" />
                    <span className="text-xs font-mono font-semibold text-gold">
                      Elite Voices
                    </span>
                    <span className="text-[10px] font-mono text-surface-500 ml-auto">
                      {fmt(data.elite.eliteTotal)}
                    </span>
                  </div>
                  {pctBar(data.elite.eliteForPct)}
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-for-400">{data.elite.eliteForPct}% For</span>
                    <span className="text-against-400">{100 - data.elite.eliteForPct}% Agt</span>
                  </div>
                </div>

                {/* Grassroots */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3 w-3 text-surface-400" />
                    <span className="text-xs font-mono font-semibold text-surface-300">
                      Grassroots
                    </span>
                    <span className="text-[10px] font-mono text-surface-500 ml-auto">
                      {fmt(data.elite.grassrootsTotal)}
                    </span>
                  </div>
                  {pctBar(data.elite.grassrootsForPct)}
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-for-400">{data.elite.grassrootsForPct}% For</span>
                    <span className="text-against-400">{100 - data.elite.grassrootsForPct}% Agt</span>
                  </div>
                </div>
              </div>

              {Math.abs(data.elite.eliteForPct - data.elite.grassrootsForPct) >= 3 && (
                <div className="mt-4 p-3 rounded-xl bg-surface-200 border border-surface-300">
                  <p className="text-xs font-mono text-surface-400 leading-relaxed">
                    {data.elite.eliteForPct > data.elite.grassrootsForPct
                      ? <>High-clout users lean <span className="text-for-300 font-semibold">FOR</span> by {data.elite.eliteForPct - data.elite.grassrootsForPct}pp more than the average voter — elite consensus is pulling stronger toward FOR.</>
                      : <>High-clout users lean <span className="text-against-300 font-semibold">AGAINST</span> by {data.elite.grassrootsForPct - data.elite.eliteForPct}pp more than the average voter — elite pressure is pushing the debate toward AGAINST.</>
                    }
                  </p>
                </div>
              )}
            </div>

            {/* Vote momentum */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center gap-2 mb-4">
                {data.momentum.momentumShift > 0 ? (
                  <TrendingUp className="h-4 w-4 text-for-400" />
                ) : data.momentum.momentumShift < 0 ? (
                  <TrendingDown className="h-4 w-4 text-against-400" />
                ) : (
                  <Flame className="h-4 w-4 text-surface-400" />
                )}
                <h2 className="text-sm font-mono font-bold text-white">
                  Vote Momentum
                </h2>
              </div>

              {data.momentum.recentTotal === 0 ? (
                <p className="text-sm font-mono text-surface-500 text-center py-4">
                  No votes in the last 7 days
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
                      Recent (7 days)
                    </p>
                    {pctBar(data.momentum.recentForPct, 'h-3')}
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-for-400">{data.momentum.recentForVotes} For</span>
                      <span className="text-against-400">{data.momentum.recentAgainstVotes} Agt</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
                      Historical
                    </p>
                    {pctBar(data.momentum.historicalForPct, 'h-3')}
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-for-400">{data.momentum.historicalForPct}% For</span>
                      <span className="text-against-400">{100 - data.momentum.historicalForPct}% Agt</span>
                    </div>
                  </div>
                </div>
              )}

              {data.momentum.recentTotal > 0 && data.momentum.momentumShift !== 0 && (
                <div className={cn(
                  'mt-4 flex items-center gap-2 p-3 rounded-xl border',
                  data.momentum.momentumShift > 0
                    ? 'bg-for-600/10 border-for-600/30'
                    : 'bg-against-600/10 border-against-600/30'
                )}>
                  {data.momentum.momentumShift > 0 ? (
                    <TrendingUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
                  )}
                  <p className="text-xs font-mono text-surface-300">
                    Recent voters are {Math.abs(data.momentum.momentumShift)}pp
                    {data.momentum.momentumShift > 0 ? ' more FOR' : ' more AGAINST'} than the historical average
                    — momentum is shifting {data.momentum.momentumShift > 0 ? 'toward FOR' : 'toward AGAINST'}.
                  </p>
                </div>
              )}
            </div>

            {/* Role breakdown */}
            {data.roleBreakdown.length > 0 && (
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="h-4 w-4 text-purple" />
                  <h2 className="text-sm font-mono font-bold text-white">
                    Breakdown by Role
                  </h2>
                </div>
                <div className="space-y-4">
                  {data.roleBreakdown.map((role) => (
                    <RoleBar key={role.role} role={role} />
                  ))}
                </div>
              </div>
            )}

            {/* Top influencers */}
            {data.topInfluencers.length > 0 && (
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald" />
                    <h2 className="text-sm font-mono font-bold text-white">
                      Most Influential Voices
                    </h2>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
                    <Info className="h-3 w-3" />
                    Ranked by clout
                  </div>
                </div>
                <div className="divide-y divide-surface-300/30">
                  {data.topInfluencers.map((inf) => (
                    <InfluencerRow key={inf.user_id} inf={inf} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {data.totalVotes === 0 && (
              <EmptyState
                icon={Scale}
                title="No votes yet"
                description="Pressure analysis will appear once citizens start voting on this topic."
              />
            )}

            {/* Link back / explore */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
              <p className="text-xs font-mono text-surface-500 mb-3">
                Explore more about this debate
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { href: `/topic/${topicId}`, label: 'Overview' },
                  { href: `/topic/${topicId}/stats`, label: 'Stats' },
                  { href: `/topic/${topicId}/momentum`, label: 'Momentum' },
                  { href: `/topic/${topicId}/voters`, label: 'Voters' },
                  { href: `/topic/${topicId}/arguments`, label: 'Arguments' },
                ].map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
                  >
                    {label}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Refresh */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={load}
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh analysis
              </button>
            </div>

          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
