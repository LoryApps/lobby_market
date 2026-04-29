'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BarChart2,
  CheckCircle2,
  Circle,
  Coins,
  Crown,
  Flame,
  RefreshCw,
  Scale,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { MarketResponse, MarketTopic } from '@/app/api/predictions/market/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Confidence bar ───────────────────────────────────────────────────────────

function ConfidenceBar({
  lawConfidence,
  size = 'md',
}: {
  lawConfidence: number
  size?: 'sm' | 'md'
}) {
  const isLaw = lawConfidence >= 65
  const isContest = lawConfidence >= 40 && lawConfidence < 65
  const barColor = isLaw
    ? 'bg-emerald'
    : isContest
    ? 'bg-gold'
    : 'bg-against-500'
  const labelColor = isLaw ? 'text-emerald' : isContest ? 'text-gold' : 'text-against-400'
  const h = size === 'sm' ? 'h-1.5' : 'h-2'

  return (
    <div className="space-y-1">
      <div className={cn('w-full rounded-full bg-surface-300 overflow-hidden', h)}>
        <div
          className={cn('h-full rounded-full transition-all duration-700', barColor)}
          style={{ width: `${lawConfidence}%` }}
        />
      </div>
      <div className="flex justify-between items-center">
        <span className={cn('text-[10px] font-mono font-semibold tabular-nums', labelColor)}>
          {lawConfidence}% LAW
        </span>
        <span className="text-[10px] font-mono text-surface-500 tabular-nums">
          {100 - lawConfidence}% FAIL
        </span>
      </div>
    </div>
  )
}

// ─── Market card ──────────────────────────────────────────────────────────────

function MarketCard({ market, index }: { market: MarketTopic; index: number }) {
  const { user_prediction: pred } = market
  const hasPosition = pred !== null
  const isWin = pred?.correct === true
  const isLoss = pred?.correct === false

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
    >
      <Link
        href={`/topic/${market.topic_id}`}
        className={cn(
          'block rounded-2xl border p-4 transition-all',
          'bg-surface-100 hover:border-surface-400',
          hasPosition
            ? isWin
              ? 'border-emerald/40 hover:border-emerald/60'
              : isLoss
              ? 'border-against-500/30 hover:border-against-500/50'
              : 'border-gold/30 hover:border-gold/50'
            : 'border-surface-300'
        )}
      >
        {/* Top row: badges */}
        <div className="flex items-center gap-2 mb-2.5 flex-wrap">
          <Badge variant={STATUS_BADGE[market.status] ?? 'proposed'}>
            {market.status.charAt(0).toUpperCase() + market.status.slice(1)}
          </Badge>
          {market.category && (
            <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
              {market.category}
            </span>
          )}
          <div className="flex items-center gap-1 ml-auto flex-shrink-0">
            <Users className="h-3 w-3 text-surface-500" />
            <span className="text-[10px] font-mono text-surface-500 tabular-nums">
              {market.total_predictions}
            </span>
          </div>
        </div>

        {/* Statement */}
        <p className="text-sm font-semibold text-white leading-snug line-clamp-2 mb-3">
          {market.statement}
        </p>

        {/* Community confidence */}
        <ConfidenceBar lawConfidence={market.law_confidence} />

        {/* User position (if any) */}
        {hasPosition && (
          <div
            className={cn(
              'mt-3 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-mono',
              isWin
                ? 'bg-emerald/10 border-emerald/30 text-emerald'
                : isLoss
                ? 'bg-against-500/10 border-against-500/30 text-against-400'
                : 'bg-gold/10 border-gold/30 text-gold'
            )}
          >
            {isWin ? (
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
            ) : isLoss ? (
              <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
            ) : (
              <Circle className="h-3.5 w-3.5 flex-shrink-0" />
            )}
            <span className="flex-1">
              You:{' '}
              <span className="font-semibold">
                {pred!.predicted_law ? 'WILL become law' : 'WILL FAIL'}
              </span>{' '}
              @ {pred!.confidence}% confidence
            </span>
            {isWin && pred!.clout_earned > 0 && (
              <span className="flex items-center gap-0.5 text-emerald font-semibold">
                +{pred!.clout_earned}
                <Coins className="h-3 w-3" />
              </span>
            )}
          </div>
        )}
      </Link>
    </motion.div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  iconClass,
}: {
  icon: typeof TrendingUp
  title: string
  subtitle: string
  iconClass: string
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl border flex-shrink-0', iconClass)}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div>
        <h2 className="font-mono text-base font-bold text-white">{title}</h2>
        <p className="text-xs text-surface-500">{subtitle}</p>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-surface-300/50', className)} />
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
      {Array.from({ length: 2 }).map((_, s) => (
        <div key={s} className="space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Empty section ────────────────────────────────────────────────────────────

function EmptySection({ label }: { label: string }) {
  return (
    <div className="py-8 text-center rounded-2xl border border-surface-300 bg-surface-100/50">
      <Scale className="h-7 w-7 text-surface-500 mx-auto mb-2" />
      <p className="text-sm font-mono text-surface-500">No {label} markets right now.</p>
      <p className="text-xs text-surface-600 mt-0.5">Check back as topics gain predictions.</p>
    </div>
  )
}

// ─── Tab selector ──────────────────────────────────────────────────────────────

type Tab = 'all' | 'my'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PredictionsPage() {
  const [data, setData] = useState<MarketResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/predictions/market')
      if (!res.ok) throw new Error('Failed to load market data')
      const json = (await res.json()) as MarketResponse
      setData(json)
    } catch {
      setError('Could not load the prediction market. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Collect "my positions" from all three buckets
  const myPositions = data
    ? [...data.leading, ...data.contested, ...data.longshots]
        .filter((m) => m.user_prediction !== null)
        .sort((a, b) => {
          // unresolved first, then by confidence
          const aRes = a.user_prediction!.resolved_at !== null ? 1 : 0
          const bRes = b.user_prediction!.resolved_at !== null ? 1 : 0
          return aRes - bRes || b.user_prediction!.confidence - a.user_prediction!.confidence
        })
    : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12" id="main-content">
        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
                <Target className="h-5 w-5 text-purple" aria-hidden="true" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">
                  Prediction Market
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Community forecasts on every live topic
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={loading || refreshing}
              aria-label="Refresh market"
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-xl flex-shrink-0',
                'bg-surface-200 border border-surface-300 text-surface-500',
                'hover:border-surface-400 hover:text-white transition-colors',
                'disabled:opacity-40'
              )}
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        {loading && <PageSkeleton />}

        {error && !loading && (
          <div className="py-12 text-center">
            <p className="text-sm text-against-400 mb-4">{error}</p>
            <button
              onClick={() => load()}
              className="px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-sm text-white hover:bg-surface-300 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {data && !loading && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              {/* ── Stats strip ─────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  icon={Scale}
                  label="Active Markets"
                  value={data.stats.total_active_markets}
                  iconClass="text-purple"
                />
                <StatCard
                  icon={Zap}
                  label="Predictions Today"
                  value={data.stats.total_predictions_today}
                  iconClass="text-for-400"
                />
                <StatCard
                  icon={BarChart2}
                  label="Avg Accuracy"
                  value={data.stats.avg_accuracy !== null ? `${data.stats.avg_accuracy}%` : '—'}
                  iconClass="text-emerald"
                  raw
                />
                <StatCard
                  icon={Trophy}
                  label="Top Predictor"
                  value={
                    data.stats.top_predictor
                      ? `@${data.stats.top_predictor.username}`
                      : '—'
                  }
                  subValue={
                    data.stats.top_predictor
                      ? `${data.stats.top_predictor.accuracy}% acc.`
                      : undefined
                  }
                  iconClass="text-gold"
                  raw
                />
              </div>

              {/* ── Tabs ────────────────────────────────────────── */}
              <div
                role="tablist"
                aria-label="Market view"
                className="flex gap-1 p-1 rounded-xl bg-surface-200 border border-surface-300"
              >
                {([['all', 'All Markets'], ['my', `My Positions (${myPositions.length})`]] as [Tab, string][]).map(
                  ([id, label]) => (
                    <button
                      key={id}
                      role="tab"
                      aria-selected={tab === id}
                      onClick={() => setTab(id)}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-sm font-mono font-medium transition-colors',
                        tab === id
                          ? 'bg-surface-100 text-white shadow-sm'
                          : 'text-surface-500 hover:text-surface-300'
                      )}
                    >
                      {label}
                    </button>
                  )
                )}
              </div>

              {/* ── All markets tab ──────────────────────────────── */}
              {tab === 'all' && (
                <div className="space-y-8">
                  {/* Leading: likely to become law */}
                  <section aria-label="Leading — likely to become law">
                    <SectionHeader
                      icon={TrendingUp}
                      title="Leading"
                      subtitle="Community confidence ≥ 65% — likely to pass"
                      iconClass="bg-emerald/10 border-emerald/30 text-emerald"
                    />
                    {data.leading.length === 0 ? (
                      <EmptySection label="leading" />
                    ) : (
                      <div className="space-y-3">
                        {data.leading.map((m, i) => (
                          <MarketCard key={m.topic_id} market={m} index={i} />
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Contested */}
                  <section aria-label="Contested — toss-up">
                    <SectionHeader
                      icon={Scale}
                      title="Contested"
                      subtitle="Market is split — true toss-ups between 40–65%"
                      iconClass="bg-gold/10 border-gold/30 text-gold"
                    />
                    {data.contested.length === 0 ? (
                      <EmptySection label="contested" />
                    ) : (
                      <div className="space-y-3">
                        {data.contested.map((m, i) => (
                          <MarketCard key={m.topic_id} market={m} index={i} />
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Longshots */}
                  <section aria-label="Longshots — unlikely to pass">
                    <SectionHeader
                      icon={TrendingDown}
                      title="Longshots"
                      subtitle="Community predicts ≤ 40% chance of passing"
                      iconClass="bg-against-500/10 border-against-500/30 text-against-400"
                    />
                    {data.longshots.length === 0 ? (
                      <EmptySection label="longshot" />
                    ) : (
                      <div className="space-y-3">
                        {data.longshots.map((m, i) => (
                          <MarketCard key={m.topic_id} market={m} index={i} />
                        ))}
                      </div>
                    )}
                  </section>

                  {/* No markets at all */}
                  {data.leading.length === 0 &&
                    data.contested.length === 0 &&
                    data.longshots.length === 0 && (
                      <div className="py-16 text-center">
                        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-purple/10 border border-purple/20 mb-6">
                          <Target className="h-8 w-8 text-purple/60" />
                        </div>
                        <h2 className="font-mono text-xl font-bold text-white mb-2">
                          Market opens soon
                        </h2>
                        <p className="text-sm text-surface-500 max-w-xs mx-auto mb-8">
                          No prediction markets yet. Visit active topics and be the first to stake
                          your forecast.
                        </p>
                        <Link
                          href="/"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-for-600 hover:bg-for-500 text-white font-mono text-sm transition-colors"
                        >
                          <Flame className="h-4 w-4" />
                          Browse the Feed
                        </Link>
                      </div>
                    )}
                </div>
              )}

              {/* ── My positions tab ─────────────────────────────── */}
              {tab === 'my' && (
                <section aria-label="My prediction positions">
                  {myPositions.length === 0 ? (
                    <div className="py-16 text-center">
                      <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gold/10 border border-gold/20 mb-6">
                        <Target className="h-8 w-8 text-gold/60" />
                      </div>
                      <h2 className="font-mono text-xl font-bold text-white mb-2">
                        No open positions
                      </h2>
                      <p className="text-sm text-surface-500 max-w-xs mx-auto mb-8">
                        Visit any active topic and use the Prediction panel to stake your forecast.
                        Accurate predictions earn Clout.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link
                          href="/"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-for-600 hover:bg-for-500 text-white font-mono text-sm transition-colors"
                        >
                          <Flame className="h-4 w-4" />
                          Browse Topics
                        </Link>
                        <Link
                          href="/predictions/leaderboard"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 border border-surface-300 text-white font-mono text-sm transition-colors"
                        >
                          <Crown className="h-4 w-4" />
                          Predictor Rankings
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs font-mono text-surface-500">
                        {myPositions.filter((m) => m.user_prediction!.resolved_at === null).length} open
                        {' · '}
                        {myPositions.filter((m) => m.user_prediction!.resolved_at !== null).length} resolved
                      </p>
                      {myPositions.map((m, i) => (
                        <MarketCard key={m.topic_id} market={m} index={i} />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* ── How it works ─────────────────────────────────── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <h3 className="font-mono text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-purple" aria-hidden="true" />
                  How predictions work
                </h3>
                <ul className="space-y-2 text-xs text-surface-500 leading-relaxed">
                  <li className="flex gap-2">
                    <span className="text-purple font-mono font-bold flex-shrink-0">1.</span>
                    Visit any active or voting topic and open the Prediction panel.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-purple font-mono font-bold flex-shrink-0">2.</span>
                    Stake a forecast: will this topic become law? Set your confidence (1–100%).
                  </li>
                  <li className="flex gap-2">
                    <span className="text-purple font-mono font-bold flex-shrink-0">3.</span>
                    When the topic resolves, your prediction is scored using a Brier score.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-purple font-mono font-bold flex-shrink-0">4.</span>
                    Accurate predictions earn Clout — track your accuracy on the Leaderboard.
                  </li>
                </ul>
                <Link
                  href="/predictions/leaderboard"
                  className="mt-4 flex items-center gap-1.5 text-xs font-mono text-purple hover:text-for-300 transition-colors"
                >
                  View predictor rankings
                  <ArrowRight className="h-3 w-3" />
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

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  iconClass,
  raw = false,
}: {
  icon: typeof TrendingUp
  label: string
  value: number | string
  subValue?: string
  iconClass: string
  raw?: boolean
}) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', iconClass)} aria-hidden="true" />
        <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wide truncate">
          {label}
        </span>
      </div>
      {raw || typeof value === 'string' ? (
        <p className="text-xl font-mono font-bold text-white truncate" title={String(value)}>
          {value}
        </p>
      ) : (
        <AnimatedNumber value={value} className="text-xl font-mono font-bold text-white" />
      )}
      {subValue && (
        <p className="text-[11px] font-mono text-surface-500 mt-0.5">{subValue}</p>
      )}
    </div>
  )
}
