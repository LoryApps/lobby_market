'use client'

/**
 * /canary — The Civic Canary
 *
 * An early-warning system that surfaces debates about to become significant —
 * before they appear in trending, triage, or surge feeds. Four signals:
 *
 *   Rising Fast      — topics gaining votes faster than their age warrants
 *   Quiet Storm      — topics with many views but few votes (about to ignite)
 *   Activation Soon  — proposed topics nearly at the support threshold
 *   Argument Surge   — topics where argument activity is accelerating
 *
 * Distinct from /triage (current urgency), /surge (high existing velocity),
 * /trending (already popular), and /heat (aggregate heat index).
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart2,
  Bird,
  ChevronRight,
  Eye,
  Flame,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CanaryResponse, CanaryTopic } from '@/app/api/canary/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Ethics: 'text-emerald',
  Culture: 'text-gold',
  Economics: 'text-against-400',
  Science: 'text-for-300',
  Philosophy: 'text-purple',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-400',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
}

// ─── Signal bar ───────────────────────────────────────────────────────────────

function SignalBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100)
  const color =
    pct >= 70 ? 'bg-against-500' : pct >= 40 ? 'bg-gold' : 'bg-for-500'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className="text-[10px] font-mono text-surface-500 w-6 text-right">
        {Math.round(pct)}
      </span>
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

interface TopicCardProps {
  topic: CanaryTopic
  signal: 'rising' | 'quiet' | 'imminent' | 'surge'
}

function TopicCard({ topic, signal }: TopicCardProps) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const catColor = CATEGORY_COLORS[topic.category ?? ''] ?? 'text-surface-400'
  const isDeadlock = Math.abs(forPct - 50) <= 5

  const metaLine = (() => {
    if (signal === 'rising') {
      return `${topic.vote_velocity.toFixed(1)} votes/hr · ${Math.round(topic.hours_old)}h old`
    }
    if (signal === 'quiet') {
      const ratio = topic.total_votes > 0 ? Math.round(topic.view_count / topic.total_votes) : topic.view_count
      return `${topic.view_count.toLocaleString()} views · ${ratio}× view/vote ratio`
    }
    if (signal === 'imminent') {
      return `${Math.round(topic.support_pct)}% to activation · ${topic.support_count.toLocaleString()} supporters`
    }
    if (signal === 'surge') {
      return `${topic.arg_count_24h} new arguments in 24h`
    }
    return ''
  })()

  const borderColor = (() => {
    if (signal === 'rising') return 'border-against-500/30 hover:border-against-400/50'
    if (signal === 'quiet') return 'border-gold/30 hover:border-gold/50'
    if (signal === 'imminent') return 'border-emerald/30 hover:border-emerald/50'
    if (signal === 'surge') return 'border-purple/30 hover:border-purple/50'
    return 'border-surface-300 hover:border-surface-400'
  })()

  const glowColor = (() => {
    if (signal === 'rising') return 'shadow-against-500/10'
    if (signal === 'quiet') return 'shadow-gold/10'
    if (signal === 'imminent') return 'shadow-emerald/10'
    if (signal === 'surge') return 'shadow-purple/10'
    return ''
  })()

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'group relative flex flex-col gap-2.5 p-4 rounded-xl',
        'bg-surface-100 border transition-all duration-200 shadow-sm',
        borderColor,
        glowColor
      )}
    >
      {/* Status + category row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
          {STATUS_LABEL[topic.status] ?? topic.status}
        </Badge>
        {topic.category && (
          <span className={cn('text-[11px] font-mono', catColor)}>{topic.category}</span>
        )}
        {isDeadlock && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-gold/15 text-gold border border-gold/30">
            DEADLOCKED
          </span>
        )}
      </div>

      {/* Statement */}
      <p className="text-sm font-medium text-white leading-snug line-clamp-2 pr-4">
        {topic.statement}
      </p>

      {/* Vote bar (only for active/voting) */}
      {topic.status !== 'proposed' && (
        <div className="space-y-1">
          <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300">
            <div className="bg-for-500 transition-all" style={{ width: `${forPct}%` }} />
            <div className="bg-against-500 flex-1" />
          </div>
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-for-400">{forPct}% FOR</span>
            <span className="text-surface-500">{topic.total_votes.toLocaleString()} votes</span>
            <span className="text-against-400">{againstPct}% AGAINST</span>
          </div>
        </div>
      )}

      {/* Support bar (proposed topics) */}
      {topic.status === 'proposed' && (
        <div className="space-y-1">
          <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300">
            <motion.div
              className="bg-emerald transition-all"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, topic.support_pct)}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-emerald">{Math.round(topic.support_pct)}% supported</span>
            <span className="text-surface-500">{topic.support_count} / {topic.activation_threshold}</span>
          </div>
        </div>
      )}

      {/* Signal line */}
      <p className="text-[11px] font-mono text-surface-500">{metaLine}</p>

      {/* Signal strength */}
      <SignalBar value={topic.signal_strength} />

      {/* Arrow */}
      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 group-hover:text-white transition-colors" />
    </Link>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

interface SectionProps {
  title: string
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  accentBg: string
  topics: CanaryTopic[]
  signal: TopicCardProps['signal']
  isLoading: boolean
  emptyTitle: string
  emptyMessage: string
}

function Section({
  title,
  subtitle,
  icon: Icon,
  iconColor,
  accentBg,
  topics,
  signal,
  isLoading,
  emptyTitle,
  emptyMessage,
}: SectionProps) {
  const [expanded, setExpanded] = useState(true)

  return (
    <section className="mb-8">
      <div className="flex items-start justify-between mb-3">
        <div>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-2 group"
            aria-expanded={expanded}
          >
            <div className={cn('p-1.5 rounded-lg', accentBg)}>
              <Icon className={cn('h-3.5 w-3.5', iconColor)} />
            </div>
            <div className="text-left">
              <h2 className={cn('text-sm font-mono font-bold', iconColor)}>
                {title}
                {topics.length > 0 && (
                  <span className="ml-2 text-[10px] font-mono text-surface-500">
                    ({topics.length})
                  </span>
                )}
              </h2>
              <p className="text-[11px] font-mono text-surface-500">{subtitle}</p>
            </div>
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-32 rounded-xl" />
                ))}
              </div>
            ) : topics.length === 0 ? (
              <EmptyState
                icon={Icon}
                title={emptyTitle}
                message={emptyMessage}
                className="py-8"
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {topics.map((t) => (
                  <TopicCard key={t.id} topic={t} signal={signal} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

// ─── Pulse stat ───────────────────────────────────────────────────────────────

function PulseStat({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-surface-100 border border-surface-200">
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5', color)} />
        <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</span>
      </div>
      <span className={cn('text-xl font-bold font-mono', color)}>{value}</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CanaryClient() {
  const [data, setData] = useState<CanaryResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/canary')
      if (res.ok) {
        const json = (await res.json()) as CanaryResponse
        setData(json)
        setLastRefresh(new Date())
      }
    } catch {
      // best-effort
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), 90_000)
    return () => clearInterval(interval)
  }, [load])

  const pulse = data?.platform_pulse

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 mb-2">
              <div className="relative p-2 rounded-xl bg-gold/15 border border-gold/30">
                <Bird className="h-5 w-5 text-gold" />
                {/* pulse dot */}
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-against-500 animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-mono text-white">The Civic Canary</h1>
                <p className="text-[11px] font-mono text-gold/70 uppercase tracking-widest">
                  Early Warning System
                </p>
              </div>
            </div>

            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-500 hover:text-white border border-surface-300 hover:border-surface-400 transition-colors disabled:opacity-50"
              aria-label="Refresh canary signals"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>

          <p className="text-sm font-mono text-surface-500 max-w-2xl mt-1">
            Detect civic debates about to become significant — before they trend.
            Signals auto-refresh every 90 seconds.
          </p>

          {lastRefresh && (
            <p className="text-[10px] font-mono text-surface-600 mt-1">
              Last updated {lastRefresh.toLocaleTimeString()}
            </p>
          )}

          {/* Explainer chips */}
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { label: 'Velocity tracking', icon: TrendingUp, color: 'text-against-400' },
              { label: 'View/vote conversion', icon: Eye, color: 'text-gold' },
              { label: 'Activation signals', icon: Zap, color: 'text-emerald' },
              { label: 'Argument momentum', icon: MessageSquare, color: 'text-purple' },
            ].map(({ label, icon: Icon, color }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono text-surface-500 bg-surface-200/60 border border-surface-300/60"
              >
                <Icon className={cn('h-3 w-3', color)} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Platform pulse stats ──────────────────────────────────────── */}
        {(isLoading || pulse) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {isLoading ? (
              [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)
            ) : pulse ? (
              <>
                <PulseStat
                  label="Active debates"
                  value={pulse.total_active}
                  icon={Flame}
                  color="text-against-400"
                />
                <PulseStat
                  label="Avg velocity"
                  value={`${pulse.avg_velocity}/hr`}
                  icon={TrendingUp}
                  color="text-for-400"
                />
                <PulseStat
                  label="Hot category"
                  value={pulse.hottest_category ?? '—'}
                  icon={BarChart2}
                  color="text-gold"
                />
                <PulseStat
                  label="Canary alerts"
                  value={pulse.total_canary_signals}
                  icon={Bird}
                  color="text-gold"
                />
              </>
            ) : null}
          </div>
        )}

        {/* ── Signal sections ───────────────────────────────────────────── */}

        <Section
          title="Rising Fast"
          subtitle="High vote velocity relative to topic age — these are accelerating"
          icon={ArrowUpRight}
          iconColor="text-against-400"
          accentBg="bg-against-500/10"
          topics={data?.rising_fast ?? []}
          signal="rising"
          isLoading={isLoading}
          emptyTitle="No fast risers detected"
          emptyMessage="No topics showing unusual vote acceleration right now."
        />

        <Section
          title="Quiet Storm"
          subtitle="High views, few votes — lots of eyeballs about to convert"
          icon={Eye}
          iconColor="text-gold"
          accentBg="bg-gold/10"
          topics={data?.quiet_storm ?? []}
          signal="quiet"
          isLoading={isLoading}
          emptyTitle="No quiet storms"
          emptyMessage="No topics have a high viewer-to-voter gap right now."
        />

        <Section
          title="Activation Imminent"
          subtitle="Proposed topics nearly at the support threshold — about to go live"
          icon={Zap}
          iconColor="text-emerald"
          accentBg="bg-emerald/10"
          topics={data?.activation_imminent ?? []}
          signal="imminent"
          isLoading={isLoading}
          emptyTitle="No imminent activations"
          emptyMessage="No proposed topics are near their activation threshold."
        />

        <Section
          title="Argument Surge"
          subtitle="Topics where argument activity is accelerating in the last 24 hours"
          icon={MessageSquare}
          iconColor="text-purple"
          accentBg="bg-purple/10"
          topics={data?.argument_surge ?? []}
          signal="surge"
          isLoading={isLoading}
          emptyTitle="No argument surges"
          emptyMessage="No unusual argument activity detected in the last 24 hours."
        />

        {/* ── Related pages ─────────────────────────────────────────────── */}
        <div className="mt-12 rounded-2xl border border-gold/20 bg-gold/5 px-6 py-6">
          <div className="flex items-center gap-2 mb-3">
            <Bird className="h-4 w-4 text-gold" />
            <h2 className="text-sm font-mono font-bold text-gold">More Signal Pages</h2>
          </div>
          <p className="text-xs font-mono text-surface-500 mb-4">
            The Canary tracks early signals. Once a topic is already moving, these pages take over.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { href: '/triage', label: 'Civic Triage', desc: 'Urgency ranking — deadlocked, expiring, starved', icon: AlertTriangle, color: 'text-against-400' },
              { href: '/trending', label: 'Trending', desc: 'Topics already gaining the most traction', icon: TrendingUp, color: 'text-for-400' },
              { href: '/heat', label: 'Heat Index', desc: 'Platform-wide temperature across categories', icon: Flame, color: 'text-against-300' },
              { href: '/tipping-point', label: 'Tipping Point', desc: 'Near the consensus threshold for law', icon: Scale, color: 'text-purple' },
              { href: '/pulse', label: 'Civic Pulse', desc: 'Live argument feed and platform vitals', icon: Sparkles, color: 'text-emerald' },
              { href: '/discover', label: 'Discover', desc: 'Personalized topic recommendations', icon: Users, color: 'text-gold' },
            ].map(({ href, label, desc, icon: Icon, color }) => (
              <Link
                key={href}
                href={href}
                className="flex items-start gap-2.5 p-3 rounded-lg bg-surface-100/60 border border-surface-300/40 hover:border-surface-400/60 hover:bg-surface-200/60 transition-colors"
              >
                <Icon className={cn('h-3.5 w-3.5 mt-0.5 flex-shrink-0', color)} />
                <div>
                  <p className="text-xs font-mono font-semibold text-white">{label}</p>
                  <p className="text-[10px] font-mono text-surface-500 leading-relaxed">{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
