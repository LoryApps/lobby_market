'use client'

/**
 * /signals — Platform Signals Dashboard
 *
 * A power-user view of the entire Lobby in one scannable screen.
 * Shows: pulse stats, topics breaking toward law, contested fights,
 * momentum movers, and category law-passage rates.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUp,
  BarChart2,
  Flame,
  Gavel,
  RefreshCw,
  Scale,
  ThumbsUp,
  TrendingUp,
  Zap,
  MessageSquare,
  Target,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  SignalsResponse,
  SignalTopic,
  MomentumTopic,
  CategoryStat,
} from '@/app/api/signals/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '…'
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const CATEGORY_COLOR: Record<string, { text: string; bar: string }> = {
  Economics:   { text: 'text-gold',        bar: 'bg-gold' },
  Politics:    { text: 'text-for-400',     bar: 'bg-for-500' },
  Technology:  { text: 'text-purple',      bar: 'bg-purple' },
  Science:     { text: 'text-emerald',     bar: 'bg-emerald' },
  Ethics:      { text: 'text-against-400', bar: 'bg-against-500' },
  Philosophy:  { text: 'text-for-300',     bar: 'bg-for-400' },
  Culture:     { text: 'text-gold',        bar: 'bg-gold' },
  Health:      { text: 'text-emerald',     bar: 'bg-emerald' },
  Environment: { text: 'text-emerald',     bar: 'bg-emerald' },
  Education:   { text: 'text-purple',      bar: 'bg-purple' },
}

function catStyle(cat: string) {
  return CATEGORY_COLOR[cat] ?? { text: 'text-surface-400', bar: 'bg-surface-500' }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PulseCard({
  value,
  label,
  icon: Icon,
  color,
}: {
  value: number
  label: string
  icon: typeof Activity
  color: string
}) {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 flex flex-col gap-1">
      <div className={cn('flex items-center gap-1.5', color)}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="text-[10px] font-mono uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold tabular-nums text-white">
        <AnimatedNumber value={value} />
      </div>
    </div>
  )
}

function VoteBar({ pct, size = 'sm' }: { pct: number; size?: 'sm' | 'xs' }) {
  const forPct = Math.round(pct)
  const againstPct = 100 - forPct
  const h = size === 'xs' ? 'h-1' : 'h-1.5'

  return (
    <div className={cn('flex w-full rounded-full overflow-hidden', h)}>
      <div
        className="bg-for-500 transition-all duration-700"
        style={{ width: `${forPct}%` }}
        aria-hidden="true"
      />
      <div
        className="bg-against-500 flex-1 transition-all duration-700"
        aria-hidden="true"
      />
      <span className="sr-only">{forPct}% For, {againstPct}% Against</span>
    </div>
  )
}

function ThresholdCard({ topic }: { topic: SignalTopic }) {
  const forPct = Math.round(topic.blue_pct)
  const gap = 80 - forPct // points needed to reach "law" threshold assumption

  return (
    <Link
      href={`/topic/${topic.id}`}
      className="group block rounded-xl border border-emerald/20 bg-emerald/5 hover:border-emerald/40 hover:bg-emerald/10 transition-all p-3"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-xs font-medium text-white leading-snug line-clamp-2 flex-1">
          {truncate(topic.statement, 90)}
        </p>
        <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} className="flex-shrink-0 text-[10px]">
          {topic.status === 'voting' ? 'VOTING' : 'ACTIVE'}
        </Badge>
      </div>

      <VoteBar pct={topic.blue_pct} />

      <div className="flex items-center justify-between mt-1.5">
        <div className="flex items-center gap-1">
          <ThumbsUp className="h-3 w-3 text-emerald" aria-hidden="true" />
          <span className="text-xs font-mono font-semibold text-emerald">
            {forPct}% FOR
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-surface-500 font-mono">
          <span>{topic.total_votes.toLocaleString()} votes</span>
          {gap > 0 && (
            <span className="text-gold">· +{gap}% needed</span>
          )}
        </div>
      </div>

      {topic.category && (
        <p className={cn('text-[10px] font-mono mt-1.5', catStyle(topic.category).text)}>
          {topic.category}
        </p>
      )}
    </Link>
  )
}

function ContestedCard({ topic }: { topic: SignalTopic }) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const delta = Math.abs(forPct - againstPct)

  return (
    <Link
      href={`/topic/${topic.id}`}
      className="group block rounded-xl border border-gold/20 bg-gold/5 hover:border-gold/40 hover:bg-gold/10 transition-all p-3"
    >
      <p className="text-xs font-medium text-white leading-snug line-clamp-2 mb-2">
        {truncate(topic.statement, 90)}
      </p>

      <VoteBar pct={topic.blue_pct} />

      <div className="flex items-center justify-between mt-1.5">
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="text-for-400">{forPct}% FOR</span>
          <span className="text-surface-500">·</span>
          <span className="text-against-400">{againstPct}% AGN</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-gold font-mono">
          <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
          <span>±{delta}%</span>
        </div>
      </div>

      {topic.category && (
        <p className={cn('text-[10px] font-mono mt-1.5', catStyle(topic.category).text)}>
          {topic.category}
        </p>
      )}
    </Link>
  )
}

function MomentumCard({ topic }: { topic: MomentumTopic }) {
  const velocity = topic.velocity.toFixed(1)

  return (
    <Link
      href={`/topic/${topic.id}`}
      className="group flex items-center gap-3 rounded-xl border border-surface-300 bg-surface-100 hover:border-surface-400 hover:bg-surface-200 transition-all p-3"
    >
      <div className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-for-500/10 border border-for-500/20">
        <ArrowUp className="h-4 w-4 text-for-400" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white leading-snug line-clamp-1">
          {truncate(topic.statement, 70)}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {topic.category && (
            <span className={cn('text-[10px] font-mono', catStyle(topic.category).text)}>
              {topic.category}
            </span>
          )}
          <span className="text-[10px] text-surface-500">·</span>
          <span className="text-[10px] font-mono text-for-400">
            {velocity} v/hr
          </span>
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-xs font-mono font-semibold text-white">
          {topic.votes_6h}
        </p>
        <p className="text-[10px] text-surface-500 font-mono">6h votes</p>
      </div>
    </Link>
  )
}

function CategoryRow({ stat }: { stat: CategoryStat }) {
  const style = catStyle(stat.category)
  const lawRateWidth = Math.min(stat.law_rate, 100)
  const avgForWidth = Math.min(stat.avg_blue_pct, 100)

  return (
    <div className="flex items-center gap-3 py-2 border-b border-surface-300/50 last:border-0">
      <div className="w-24 flex-shrink-0">
        <span className={cn('text-xs font-mono font-semibold', style.text)}>
          {stat.category}
        </span>
      </div>

      <div className="flex-1 space-y-1">
        {/* Law passage rate bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-surface-300">
            <motion.div
              className={cn('h-full rounded-full', style.bar)}
              initial={{ width: 0 }}
              animate={{ width: `${lawRateWidth}%` }}
              transition={{ duration: 0.8, delay: 0.1 }}
            />
          </div>
          <span className="text-[10px] font-mono text-surface-400 w-8 text-right">
            {stat.law_rate}%
          </span>
        </div>
        {/* Average FOR sentiment */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-surface-300 overflow-hidden">
            <motion.div
              className="h-full bg-for-500/40"
              initial={{ width: 0 }}
              animate={{ width: `${avgForWidth}%` }}
              transition={{ duration: 0.8, delay: 0.2 }}
            />
          </div>
          <span className="text-[10px] font-mono text-surface-500 w-8 text-right">
            {stat.avg_blue_pct}%
          </span>
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center gap-1.5 text-[10px] font-mono text-surface-500">
        <span className="text-gold">{stat.law}</span>
        <span>/</span>
        <span>{stat.total}</span>
      </div>
    </div>
  )
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function PulseSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 h-20 animate-pulse" />
      ))}
    </div>
  )
}

function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="h-20 rounded-xl bg-surface-200/50 animate-pulse border border-surface-300" />
      ))}
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  iconClass,
  subtitle,
  children,
  emptyText = 'No signals right now.',
  isEmpty,
}: {
  title: string
  icon: typeof Activity
  iconClass: string
  subtitle?: string
  children: React.ReactNode
  emptyText?: string
  isEmpty?: boolean
}) {
  return (
    <section className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', iconClass)}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            {subtitle && (
              <p className="text-[10px] font-mono text-surface-500">{subtitle}</p>
            )}
          </div>
        </div>
      </div>

      {isEmpty ? (
        <p className="text-xs font-mono text-surface-500 py-4 text-center">{emptyText}</p>
      ) : (
        children
      )}
    </section>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SignalsPage() {
  const [data, setData] = useState<SignalsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(false)

    try {
      const res = await fetch('/api/signals', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed')
      const json: SignalsResponse = await res.json()
      setData(json)
      setLastRefresh(new Date())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Auto-refresh every 90 seconds
    const id = setInterval(() => load(true), 90_000)
    return () => clearInterval(id)
  }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-6 pb-28 md:pb-12 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-5 w-5 text-for-400" aria-hidden="true" />
              <h1 className="text-xl font-bold text-white tracking-tight">
                Signals
              </h1>
              <span className="text-[10px] font-mono text-surface-500 bg-surface-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Live
              </span>
            </div>
            <p className="text-xs font-mono text-surface-500">
              Platform-wide consensus signals — updated every 90 seconds.
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            aria-label="Refresh signals"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-300 bg-surface-200 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} aria-hidden="true" />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {loading && (
          <div className="space-y-6">
            <PulseSkeleton />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CardsSkeleton count={4} />
              <CardsSkeleton count={4} />
            </div>
            <CardsSkeleton count={5} />
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertTriangle className="h-8 w-8 text-against-400" aria-hidden="true" />
            <p className="text-sm text-surface-500 font-mono">Failed to load signals.</p>
            <button
              onClick={() => load()}
              className="text-xs font-mono text-for-400 hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {data && !loading && (
            <motion.div
              key="loaded"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Pulse strip */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <PulseCard
                  value={data.pulse.active_topics}
                  label="Active"
                  icon={Zap}
                  color="text-for-400"
                />
                <PulseCard
                  value={data.pulse.voting_topics}
                  label="Voting"
                  icon={Scale}
                  color="text-purple"
                />
                <PulseCard
                  value={data.pulse.laws_this_week}
                  label="Laws / Week"
                  icon={Gavel}
                  color="text-gold"
                />
                <PulseCard
                  value={data.pulse.votes_today}
                  label="Votes Today"
                  icon={Flame}
                  color="text-against-400"
                />
                <PulseCard
                  value={data.pulse.arguments_today}
                  label="Arguments"
                  icon={MessageSquare}
                  color="text-emerald"
                />
              </div>

              {/* Two-column grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Breaking threshold */}
                <Section
                  title="Breaking Threshold"
                  icon={TrendingUp}
                  iconClass="bg-emerald/20 text-emerald"
                  subtitle="Topics 62–79% FOR — approaching law"
                  isEmpty={data.breaking_threshold.length === 0}
                  emptyText="No topics approaching threshold right now."
                >
                  <div className="space-y-2">
                    {data.breaking_threshold.map((t) => (
                      <ThresholdCard key={t.id} topic={t} />
                    ))}
                  </div>
                  {data.breaking_threshold.length > 0 && (
                    <Link
                      href="/surge"
                      className="flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-emerald transition-colors pt-1"
                    >
                      View all surge topics
                      <ArrowRight className="h-2.5 w-2.5" aria-hidden="true" />
                    </Link>
                  )}
                </Section>

                {/* Contested */}
                <Section
                  title="Contested"
                  icon={Target}
                  iconClass="bg-gold/20 text-gold"
                  subtitle="Tightest fights — 44–56% split"
                  isEmpty={data.contested.length === 0}
                  emptyText="No closely contested topics right now."
                >
                  <div className="space-y-2">
                    {data.contested.map((t) => (
                      <ContestedCard key={t.id} topic={t} />
                    ))}
                  </div>
                  {data.contested.length > 0 && (
                    <Link
                      href="/split"
                      className="flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-gold transition-colors pt-1"
                    >
                      View all contested topics
                      <ArrowRight className="h-2.5 w-2.5" aria-hidden="true" />
                    </Link>
                  )}
                </Section>
              </div>

              {/* Momentum */}
              <Section
                title="Momentum"
                icon={ArrowUp}
                iconClass="bg-for-500/20 text-for-400"
                subtitle="Fastest-gaining topics in the last 6 hours"
                isEmpty={data.momentum.length === 0}
                emptyText="No momentum data for this window."
              >
                <div className="space-y-2">
                  {data.momentum.map((t) => (
                    <MomentumCard key={t.id} topic={t} />
                  ))}
                </div>
                {data.momentum.length > 0 && (
                  <Link
                    href="/momentum"
                    className="flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-for-400 transition-colors pt-1"
                  >
                    Full momentum board
                    <ArrowRight className="h-2.5 w-2.5" aria-hidden="true" />
                  </Link>
                )}
              </Section>

              {/* Category breakdown */}
              <Section
                title="Category Intelligence"
                icon={BarChart2}
                iconClass="bg-purple/20 text-purple"
                subtitle="Law-passage rate · Average FOR sentiment · Laws / Total topics"
              >
                <div className="flex items-center gap-4 text-[10px] font-mono text-surface-500 pb-1 border-b border-surface-300">
                  <span className="w-24 flex-shrink-0">Category</span>
                  <span className="flex-1">Law rate · Avg FOR</span>
                  <span className="flex-shrink-0 text-right">Laws</span>
                </div>
                {data.categories.map((stat) => (
                  <CategoryRow key={stat.category} stat={stat} />
                ))}
                <div className="flex items-center justify-between pt-2">
                  <Link
                    href="/categories"
                    className="flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-purple transition-colors"
                  >
                    Browse topics by category
                    <ArrowRight className="h-2.5 w-2.5" aria-hidden="true" />
                  </Link>
                  <Link
                    href="/heatmap"
                    className="flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-purple transition-colors"
                  >
                    Open heatmap
                    <ArrowRight className="h-2.5 w-2.5" aria-hidden="true" />
                  </Link>
                  <Link
                    href="/polarization"
                    className="flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-purple transition-colors"
                  >
                    Polarization index
                    <ArrowRight className="h-2.5 w-2.5" aria-hidden="true" />
                  </Link>
                </div>
              </Section>

              {/* Footer refresh note */}
              <p className="text-center text-[10px] font-mono text-surface-500">
                Last updated: {lastRefresh.toLocaleTimeString()} · Auto-refreshes every 90s
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
