'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  Crown,
  Gauge,
  Layers,
  RefreshCw,
  Scale,
  Target,
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
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  DepthResponse,
  DepthTimelineBucket,
  DepthVoterProfile,
} from '@/app/api/exchange/[id]/depth/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// ─── Mini Sparkline ───────────────────────────────────────────────────────────

function Sparkline({
  buckets,
}: {
  buckets: DepthTimelineBucket[]
}) {
  if (buckets.length < 2) return null

  const maxBlue = Math.max(...buckets.map(b => b.cumulative_blue), 1)
  const maxRed = Math.max(...buckets.map(b => b.cumulative_red), 1)
  const maxVal = Math.max(maxBlue, maxRed, 1)
  const W = 320
  const H = 80
  const pad = 4

  const points = (vals: number[], color: string) => {
    const pts = vals
      .map((v, i) => {
        const x = pad + (i / (vals.length - 1)) * (W - pad * 2)
        const y = H - pad - (v / maxVal) * (H - pad * 2)
        return `${x},${y}`
      })
      .join(' ')
    return (
      <polyline
        key={color}
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    )
  }

  const blueVals = buckets.map(b => b.cumulative_blue)
  const redVals = buckets.map(b => b.cumulative_red)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: H }}
      aria-hidden
    >
      {points(blueVals, '#3b82f6')}
      {points(redVals, '#ef4444')}
    </svg>
  )
}

// ─── Volume Bar ───────────────────────────────────────────────────────────────

function VolumeBar({
  buckets,
}: {
  buckets: DepthTimelineBucket[]
}) {
  if (buckets.length === 0) return null
  const maxVol = Math.max(...buckets.map(b => b.blue_votes + b.red_votes), 1)

  return (
    <div className="flex items-end gap-px h-10 mt-2">
      {buckets.map(b => {
        const total = b.blue_votes + b.red_votes
        const height = Math.round((total / maxVol) * 40)
        const blueFrac = total > 0 ? b.blue_votes / total : 0.5
        return (
          <div
            key={b.date}
            className="flex-1 flex flex-col items-stretch rounded-sm overflow-hidden"
            style={{ height: `${height}px` }}
            title={`${b.date}: +${b.blue_votes} FOR, +${b.red_votes} AGAINST`}
          >
            <div
              className="bg-for-500"
              style={{ flex: blueFrac, minHeight: 1 }}
            />
            <div
              className="bg-against-500"
              style={{ flex: 1 - blueFrac, minHeight: 1 }}
            />
          </div>
        )
      })}
    </div>
  )
}

// ─── Voter Profile Card ───────────────────────────────────────────────────────

function VoterProfileCard({
  side,
  profile,
}: {
  side: 'for' | 'against'
  profile: DepthVoterProfile
}) {
  const isFor = side === 'for'
  const label = isFor ? 'FOR' : 'AGAINST'

  return (
    <div
      className={cn(
        'rounded-xl border p-4 space-y-3',
        isFor
          ? 'border-for-500/30 bg-for-900/10'
          : 'border-against-500/30 bg-against-900/10',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isFor ? (
            <ThumbsUp className="w-4 h-4 text-for-400" />
          ) : (
            <ThumbsDown className="w-4 h-4 text-against-400" />
          )}
          <span
            className={cn(
              'text-xs font-bold tracking-widest',
              isFor ? 'text-for-400' : 'text-against-400',
            )}
          >
            {label}
          </span>
        </div>
        <span className="text-surface-300 text-sm font-medium">
          {formatNum(profile.count)} voters
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-surface-800 rounded-lg p-2 text-center">
          <div className="text-xs text-surface-400 mb-0.5">Avg Clout</div>
          <div className="text-sm font-bold text-surface-100">
            {formatNum(profile.avg_clout)}
          </div>
        </div>
        <div className="bg-surface-800 rounded-lg p-2 text-center">
          <div className="text-xs text-surface-400 mb-0.5">High Clout</div>
          <div className="text-sm font-bold text-surface-100">
            {profile.high_clout_count}
            <span className="text-surface-500 text-xs ml-1">
              ({profile.count > 0 ? Math.round((profile.high_clout_count / profile.count) * 100) : 0}%)
            </span>
          </div>
        </div>
      </div>

      {/* Top voters */}
      {profile.top_voters.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-surface-500 font-medium uppercase tracking-wider">
            Top Voices
          </div>
          <div className="space-y-1.5">
            {profile.top_voters.slice(0, 5).map((voter, i) => (
              <Link
                key={voter.username}
                href={`/profile/${voter.username}`}
                className="flex items-center gap-2 group"
              >
                <span className="text-xs text-surface-600 w-4 shrink-0">
                  {i + 1}.
                </span>
                <Avatar
                  src={voter.avatar_url ?? undefined}
                  username={voter.username}
                  size="xs"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-surface-300 group-hover:text-surface-100 truncate block">
                    {voter.display_name ?? voter.username}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Crown className="w-3 h-3 text-gold opacity-70" />
                  <span className="text-xs text-surface-400">
                    {formatNum(voter.clout)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sensitivity Row ──────────────────────────────────────────────────────────

function SensitivityRow({
  label,
  votes,
  direction,
  currentPrice,
  targetPrice,
}: {
  label: string
  votes: number | null
  direction: 'up' | 'down'
  currentPrice: number
  targetPrice: number
}) {
  if (votes === null) return null
  const isUp = direction === 'up'
  const dist = Math.abs(targetPrice - currentPrice)

  return (
    <div className="flex items-center gap-3 py-2 border-b border-surface-700/50 last:border-0">
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
          isUp ? 'bg-for-900/40' : 'bg-against-900/40',
        )}
      >
        {isUp ? (
          <TrendingUp className="w-4 h-4 text-for-400" />
        ) : (
          <TrendingDown className="w-4 h-4 text-against-400" />
        )}
      </div>
      <div className="flex-1">
        <div className="text-sm text-surface-200">{label}</div>
        <div className="text-xs text-surface-500">{dist}¢ away</div>
      </div>
      <div className="text-right">
        <div
          className={cn(
            'text-sm font-bold',
            isUp ? 'text-for-400' : 'text-against-400',
          )}
        >
          +{formatNum(votes)}
        </div>
        <div className="text-xs text-surface-500">
          {isUp ? 'FOR' : 'AGAINST'} votes
        </div>
      </div>
    </div>
  )
}

// ─── Main Client ─────────────────────────────────────────────────────────────

interface Props {
  id: string
}

export function DepthClient({ id }: Props) {
  const [data, setData] = useState<DepthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true)
      else setRefreshing(true)
      setError(null)
      try {
        const res = await fetch(`/api/exchange/${id}/depth`)
        if (!res.ok) throw new Error('Failed to load depth data')
        const json: DepthResponse = await res.json()
        setData(json)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [id],
  )

  useEffect(() => {
    load()
  }, [load])

  const topic = data?.topic

  return (
    <div className="min-h-screen bg-surface-950 text-surface-100 pb-24">
      <TopBar />

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-6">
        {/* Back nav */}
        <div className="flex items-center gap-3">
          <Link
            href={`/exchange/${id}`}
            className="flex items-center gap-1.5 text-surface-400 hover:text-surface-100 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Market
          </Link>
          <ChevronRight className="w-3 h-3 text-surface-600" />
          <span className="text-surface-300 text-sm">Depth</span>
        </div>

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-4 h-4 text-purple" />
            <span className="text-xs font-bold tracking-widest text-purple uppercase">
              Market Depth
            </span>
          </div>
          {loading ? (
            <Skeleton className="h-6 w-3/4 mb-2" />
          ) : (
            <h1 className="text-lg font-bold text-surface-50 leading-snug">
              {topic?.statement}
            </h1>
          )}
          {loading ? (
            <Skeleton className="h-4 w-1/3 mt-1" />
          ) : (
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-2xl font-bold text-for-400">
                {topic?.blue_pct}¢
              </span>
              <span className="text-surface-400 text-sm">
                {formatNum(topic?.total_votes ?? 0)} votes
              </span>
              {topic?.category && (
                <Badge variant="surface" size="sm">
                  {topic.category}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && !loading && (
          <EmptyState
            icon={Activity}
            title="Failed to load depth"
            description={error}
            action={{ label: 'Retry', onClick: () => load() }}
          />
        )}

        {/* Skeleton loading */}
        {loading && (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        )}

        {data && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* ── Momentum banner ─────────────────────────────────────────── */}
            <MomentumBanner data={data} />

            {/* ── Cumulative vote chart ────────────────────────────────────── */}
            <section className="bg-surface-900 rounded-xl border border-surface-700/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-surface-400" />
                  <span className="text-sm font-semibold text-surface-200">
                    Cumulative Vote History
                  </span>
                </div>
                <button
                  onClick={() => load(true)}
                  disabled={refreshing}
                  className="text-surface-500 hover:text-surface-200 transition-colors"
                  aria-label="Refresh"
                >
                  <RefreshCw
                    className={cn('w-4 h-4', refreshing && 'animate-spin')}
                  />
                </button>
              </div>

              {data.timeline.length >= 2 ? (
                <>
                  <Sparkline buckets={data.timeline} />
                  <VolumeBar buckets={data.timeline} />
                  <div className="flex items-center gap-4 text-xs text-surface-500">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-for-500 inline-block rounded" />
                      FOR
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-against-500 inline-block rounded" />
                      AGAINST
                    </div>
                    <span className="ml-auto">
                      {data.timeline.length} day{data.timeline.length !== 1 ? 's' : ''} of data
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-surface-500 text-center py-4">
                  Not enough history yet
                </p>
              )}
            </section>

            {/* ── Voter profiles ───────────────────────────────────────────── */}
            <section>
              <h2 className="text-sm font-semibold text-surface-300 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-surface-500" />
                Voter Conviction Profiles
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <VoterProfileCard side="for" profile={data.for_profile} />
                <VoterProfileCard side="against" profile={data.against_profile} />
              </div>
            </section>

            {/* ── Vote concentration ───────────────────────────────────────── */}
            <ConcentrationCard data={data} />

            {/* ── Price sensitivity ────────────────────────────────────────── */}
            <PriceSensitivityCard data={data} />

            {/* ── Related links ────────────────────────────────────────────── */}
            <nav className="grid grid-cols-2 gap-2 text-sm">
              {[
                { href: `/exchange/${id}/traders`, label: 'Traders', icon: Users },
                { href: `/exchange/${id}/orderbook`, label: 'Order Book', icon: Scale },
                { href: `/exchange/${id}/activity`, label: 'Activity', icon: Activity },
                { href: `/exchange/${id}/signal`, label: 'Signals', icon: Zap },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface-800 hover:bg-surface-700 border border-surface-700 transition-colors text-surface-300 hover:text-surface-100"
                >
                  <Icon className="w-4 h-4 text-surface-500" />
                  {label}
                  <ArrowRight className="w-3 h-3 ml-auto text-surface-600" />
                </Link>
              ))}
            </nav>
          </motion.div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MomentumBanner({ data }: { data: DepthResponse }) {
  const { velocity } = data
  const isBullish = velocity.momentum === 'bullish'
  const isBearish = velocity.momentum === 'bearish'

  const recentTotal = velocity.recent_blue + velocity.recent_red
  const priorTotal = velocity.prior_blue + velocity.prior_red
  const volumeChange = priorTotal > 0
    ? Math.round(((recentTotal - priorTotal) / priorTotal) * 100)
    : 0

  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        isBullish
          ? 'border-for-500/40 bg-for-900/15'
          : isBearish
            ? 'border-against-500/40 bg-against-900/15'
            : 'border-surface-700 bg-surface-800/60',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
            isBullish ? 'bg-for-900/60' : isBearish ? 'bg-against-900/60' : 'bg-surface-700',
          )}
        >
          {isBullish ? (
            <TrendingUp className="w-5 h-5 text-for-400" />
          ) : isBearish ? (
            <TrendingDown className="w-5 h-5 text-against-400" />
          ) : (
            <Gauge className="w-5 h-5 text-surface-400" />
          )}
        </div>
        <div className="flex-1">
          <div
            className={cn(
              'text-sm font-semibold mb-1',
              isBullish ? 'text-for-300' : isBearish ? 'text-against-300' : 'text-surface-200',
            )}
          >
            {isBullish
              ? 'FOR momentum is building'
              : isBearish
                ? 'AGAINST pressure is rising'
                : 'Market is balanced'}
          </div>
          <div className="text-xs text-surface-400 space-y-0.5">
            <div>
              Last 7d:{' '}
              <span className="text-for-400">{velocity.recent_blue} FOR</span>
              {' / '}
              <span className="text-against-400">{velocity.recent_red} AGAINST</span>
            </div>
            <div>
              Prior 7d:{' '}
              <span className="text-surface-500">{velocity.prior_blue} FOR</span>
              {' / '}
              <span className="text-surface-500">{velocity.prior_red} AGAINST</span>
            </div>
            {priorTotal > 0 && (
              <div>
                Volume{' '}
                <span
                  className={
                    volumeChange >= 0 ? 'text-emerald' : 'text-against-400'
                  }
                >
                  {volumeChange >= 0 ? '+' : ''}{volumeChange}%
                </span>{' '}
                week-over-week
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ConcentrationCard({ data }: { data: DepthResponse }) {
  const { concentration } = data
  const giniPct = Math.round(concentration.gini * 100)

  const giniLabel =
    giniPct < 20 ? 'Very equal'
    : giniPct < 40 ? 'Fairly equal'
    : giniPct < 60 ? 'Moderately concentrated'
    : giniPct < 80 ? 'Concentrated'
    : 'Highly concentrated'

  return (
    <section className="bg-surface-900 rounded-xl border border-surface-700/60 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-surface-200 flex items-center gap-2">
        <Target className="w-4 h-4 text-surface-500" />
        Vote Concentration
      </h2>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-surface-800 rounded-lg p-2.5 text-center">
          <div className="text-xs text-surface-400 mb-1">Top 5</div>
          <div className="text-lg font-bold text-surface-100">
            {concentration.top5_pct}%
          </div>
          <div className="text-xs text-surface-500">of clout</div>
        </div>
        <div className="bg-surface-800 rounded-lg p-2.5 text-center">
          <div className="text-xs text-surface-400 mb-1">Top 10</div>
          <div className="text-lg font-bold text-surface-100">
            {concentration.top10_pct}%
          </div>
          <div className="text-xs text-surface-500">of clout</div>
        </div>
        <div className="bg-surface-800 rounded-lg p-2.5 text-center">
          <div className="text-xs text-surface-400 mb-1">Gini</div>
          <div className="text-lg font-bold text-surface-100">
            {concentration.gini.toFixed(2)}
          </div>
          <div className="text-xs text-surface-500">coefficient</div>
        </div>
      </div>

      {/* Gini bar */}
      <div>
        <div className="flex justify-between text-xs text-surface-500 mb-1">
          <span>Equal</span>
          <span>{giniLabel}</span>
          <span>Whale</span>
        </div>
        <div className="w-full bg-surface-800 rounded-full h-2">
          <div
            className="bg-purple h-2 rounded-full transition-all duration-700"
            style={{ width: `${giniPct}%` }}
          />
        </div>
      </div>

      <p className="text-xs text-surface-500">
        {concentration.top5_pct < 30
          ? 'Vote distribution is broad — this market reflects genuine mass conviction.'
          : concentration.top5_pct < 60
            ? 'A small group of high-clout voters holds significant sway over this market.'
            : 'This market is heavily concentrated — a few whales dominate the signal.'}
      </p>
    </section>
  )
}

function PriceSensitivityCard({ data }: { data: DepthResponse }) {
  const { sensitivity, topic } = data
  const currentPrice = topic.blue_pct

  const upThresholds = [
    { key: 'to_50', label: 'Parity (50¢)', target: 50 },
    { key: 'to_55', label: 'Majority (55¢)', target: 55 },
    { key: 'to_60', label: 'Clear lead (60¢)', target: 60 },
    { key: 'to_67', label: 'Supermajority (67¢)', target: 67 },
    { key: 'to_75', label: 'Dominance (75¢)', target: 75 },
  ] as const

  const downThresholds = [
    { key: 'to_45', label: 'Below parity (45¢)', target: 45 },
    { key: 'to_33', label: 'Decisive rejection (33¢)', target: 33 },
  ] as const

  const upRows = upThresholds.filter(
    t => sensitivity[t.key] !== null && currentPrice < t.target,
  )
  const downRows = downThresholds.filter(
    t => sensitivity[t.key] !== null && currentPrice > t.target,
  )

  if (upRows.length === 0 && downRows.length === 0) return null

  return (
    <section className="bg-surface-900 rounded-xl border border-surface-700/60 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-surface-200 flex items-center gap-2">
        <Gauge className="w-4 h-4 text-surface-500" />
        Price Sensitivity
        <span className="text-xs text-surface-500 font-normal">
          — votes needed to reach each level
        </span>
      </h2>

      <div className="divide-y divide-surface-700/40">
        {upRows.map(t => (
          <SensitivityRow
            key={t.key}
            label={t.label}
            votes={sensitivity[t.key]}
            direction="up"
            currentPrice={currentPrice}
            targetPrice={t.target}
          />
        ))}
        {downRows.map(t => (
          <SensitivityRow
            key={t.key}
            label={t.label}
            votes={sensitivity[t.key]}
            direction="down"
            currentPrice={currentPrice}
            targetPrice={t.target}
          />
        ))}
      </div>

      <p className="text-xs text-surface-500">
        Estimates assume all additional votes favour one side. Actual price depends on how many votes you add relative to current total.
      </p>
    </section>
  )
}
