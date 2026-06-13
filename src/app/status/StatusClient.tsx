'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Database,
  Gavel,
  Globe,
  Key,
  RefreshCw,
  Server,
  Users,
  Vote,
  XCircle,
  Zap,
  MessageSquare,
  Scale,
  FileText,
  TrendingUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { PlatformStatus, ComponentStatus, StatusEvent } from '@/app/api/status/route'

// ─── Config ────────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 30_000

// ─── Status helpers ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  operational: {
    label: 'All Systems Operational',
    shortLabel: 'Operational',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    dot: 'bg-emerald',
    icon: CheckCircle2,
  },
  degraded: {
    label: 'Partial Degradation',
    shortLabel: 'Degraded',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    dot: 'bg-gold',
    icon: AlertTriangle,
  },
  outage: {
    label: 'Major Outage',
    shortLabel: 'Outage',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    dot: 'bg-against-400',
    icon: XCircle,
  },
} as const

const COMPONENT_ICONS: Record<string, typeof Database> = {
  Database,
  API: Server,
  Auth: Key,
}

const EVENT_CONFIG = {
  law_established: {
    icon: Gavel,
    label: 'Law established',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/20',
  },
  topic_activated: {
    icon: Zap,
    label: 'Topic activated',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/20',
  },
  debate_concluded: {
    icon: Scale,
    label: 'Debate concluded',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/20',
  },
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function OverallBanner({
  status,
  checkedAt,
}: {
  status: PlatformStatus['overall']
  checkedAt: string
}) {
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon

  return (
    <motion.div
      key={status}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-6 flex items-center gap-5',
        cfg.bg,
        cfg.border,
      )}
    >
      {/* Pulsing dot */}
      <div className="relative flex-shrink-0">
        <div className={cn('h-4 w-4 rounded-full', cfg.dot)} />
        {status === 'operational' && (
          <div
            className={cn(
              'absolute inset-0 rounded-full animate-ping opacity-40',
              cfg.dot,
            )}
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn('font-mono font-bold text-lg', cfg.color)}>{cfg.label}</p>
        <p className="font-mono text-xs text-surface-500 mt-0.5">
          Last checked {new Date(checkedAt).toLocaleTimeString()} ·{' '}
          <span className="text-surface-400">auto-refreshes every 30s</span>
        </p>
      </div>

      <Icon className={cn('h-6 w-6 flex-shrink-0', cfg.color)} />
    </motion.div>
  )
}

function ComponentRow({ component }: { component: ComponentStatus }) {
  const cfg = STATUS_CONFIG[component.status]
  const Icon = COMPONENT_ICONS[component.name] ?? Activity

  return (
    <div className="flex items-center justify-between py-4 border-b border-surface-300 last:border-0">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 flex items-center justify-center flex-shrink-0">
          <Icon className="h-4 w-4 text-surface-500" />
        </div>
        <div>
          <p className="font-mono text-sm font-medium text-white">{component.name}</p>
          {component.message && (
            <p className="font-mono text-xs text-against-400 mt-0.5 truncate max-w-[200px]">
              {component.message}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {component.latency_ms !== null && (
          <span className="font-mono text-xs text-surface-500">
            {component.latency_ms}ms
          </span>
        )}
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium border',
            cfg.bg,
            cfg.border,
            cfg.color,
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', cfg.dot)} />
          {cfg.shortLabel}
        </span>
      </div>
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
  border,
}: {
  icon: typeof Activity
  label: string
  value: number
  color: string
  bg: string
  border: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4 flex flex-col gap-2',
        bg,
        border,
        'bg-surface-100',
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', color)} />
        <span className="font-mono text-xs text-surface-500">{label}</span>
      </div>
      <p className={cn('font-mono text-2xl font-bold', color)}>
        <AnimatedNumber value={value} />
      </p>
    </div>
  )
}

function EventItem({ event }: { event: StatusEvent }) {
  const cfg = EVENT_CONFIG[event.type]
  const Icon = cfg.icon

  const relativeTime = (() => {
    const diff = Date.now() - new Date(event.occurred_at).getTime()
    const mins = Math.floor(diff / 60_000)
    const hours = Math.floor(diff / 3_600_000)
    const days = Math.floor(diff / 86_400_000)
    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (mins > 0) return `${mins}m ago`
    return 'just now'
  })()

  const href =
    event.type === 'law_established' || event.type === 'topic_activated'
      ? `/topic/${event.id}`
      : `/debate/${event.id}`

  return (
    <Link
      href={href}
      className={cn(
        'flex items-start gap-3 py-3 border-b border-surface-300 last:border-0',
        'hover:bg-surface-200/50 rounded-lg px-2 -mx-2 transition-colors',
      )}
    >
      <div
        className={cn(
          'h-7 w-7 rounded-lg border flex items-center justify-center flex-shrink-0 mt-0.5',
          cfg.bg,
          cfg.border,
        )}
      >
        <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-xs text-surface-500 mb-0.5">{cfg.label}</p>
        <p className="font-mono text-sm text-white leading-snug line-clamp-2">
          {event.label}
        </p>
        {event.category && (
          <p className="font-mono text-xs text-surface-500 mt-0.5">{event.category}</p>
        )}
      </div>
      <span className="font-mono text-xs text-surface-500 flex-shrink-0 mt-0.5">
        {relativeTime}
      </span>
    </Link>
  )
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function StatusSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function StatusClient() {
  const [data, setData] = useState<PlatformStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [nextRefresh, setNextRefresh] = useState(REFRESH_INTERVAL_MS / 1000)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  const fetchStatus = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/status', { cache: 'no-store' })
      const json: PlatformStatus = await res.json()
      setData(json)
    } catch {
      setError('Could not reach the status API.')
    } finally {
      setLoading(false)
      setRefreshing(false)
      setNextRefresh(REFRESH_INTERVAL_MS / 1000)
    }
  }, [])

  // Auto-refresh
  useEffect(() => {
    fetchStatus()

    timerRef.current = setInterval(() => {
      fetchStatus()
    }, REFRESH_INTERVAL_MS)

    // Countdown ticker
    countdownRef.current = setInterval(() => {
      setNextRefresh((prev) => (prev <= 1 ? REFRESH_INTERVAL_MS / 1000 : prev - 1))
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [fetchStatus])

  const handleRefresh = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    fetchStatus(true).then(() => {
      timerRef.current = setInterval(() => fetchStatus(), REFRESH_INTERVAL_MS)
      countdownRef.current = setInterval(() => {
        setNextRefresh((prev) => (prev <= 1 ? REFRESH_INTERVAL_MS / 1000 : prev - 1))
      }, 1000)
    })
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-surface-500 hover:text-white font-mono text-sm mb-4 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-mono font-bold text-2xl text-white">Platform Status</h1>
              <p className="font-mono text-sm text-surface-500 mt-1">
                Live health and activity for Lobby Market
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 font-mono text-xs transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              {refreshing ? 'Refreshing…' : `Refresh (${nextRefresh}s)`}
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <StatusSkeleton />
        ) : error ? (
          <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-8 text-center">
            <XCircle className="h-8 w-8 text-against-400 mx-auto mb-3" />
            <p className="font-mono text-white font-bold mb-1">Could not load status</p>
            <p className="font-mono text-xs text-surface-500 mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-white font-mono text-sm hover:bg-surface-300 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : data ? (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Overall banner */}
              <OverallBanner status={data.overall} checkedAt={data.checked_at} />

              {/* Platform Metrics */}
              <section>
                <h2 className="font-mono text-xs font-bold text-surface-500 uppercase tracking-widest mb-3">
                  Platform Metrics
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <MetricCard
                    icon={FileText}
                    label="Total Topics"
                    value={data.metrics.topics.total}
                    color="text-for-400"
                    bg="bg-for-500/5"
                    border="border-for-500/20"
                  />
                  <MetricCard
                    icon={Gavel}
                    label="Laws Established"
                    value={data.metrics.topics.laws}
                    color="text-gold"
                    bg="bg-gold/5"
                    border="border-gold/20"
                  />
                  <MetricCard
                    icon={Zap}
                    label="Active Debates"
                    value={data.metrics.topics.active + data.metrics.topics.voting}
                    color="text-emerald"
                    bg="bg-emerald/5"
                    border="border-emerald/20"
                  />
                  <MetricCard
                    icon={Vote}
                    label="Votes Cast"
                    value={data.metrics.votes}
                    color="text-purple"
                    bg="bg-purple/5"
                    border="border-purple/20"
                  />
                  <MetricCard
                    icon={MessageSquare}
                    label="Arguments"
                    value={data.metrics.arguments}
                    color="text-for-300"
                    bg="bg-for-400/5"
                    border="border-for-400/20"
                  />
                  <MetricCard
                    icon={Users}
                    label="Citizens"
                    value={data.metrics.users}
                    color="text-surface-400"
                    bg="bg-surface-200/50"
                    border="border-surface-300"
                  />
                </div>

                {/* Topic status breakdown */}
                <div className="mt-3 rounded-xl bg-surface-100 border border-surface-300 p-4">
                  <p className="font-mono text-xs text-surface-500 mb-3">Topic Status Breakdown</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      { label: 'Proposed', val: data.metrics.topics.proposed, color: 'text-surface-400', dot: 'bg-surface-400' },
                      { label: 'Active', val: data.metrics.topics.active, color: 'text-for-400', dot: 'bg-for-400' },
                      { label: 'Voting', val: data.metrics.topics.voting, color: 'text-purple', dot: 'bg-purple' },
                      { label: 'Laws', val: data.metrics.topics.laws, color: 'text-gold', dot: 'bg-gold' },
                      { label: 'Failed', val: data.metrics.topics.failed, color: 'text-surface-500', dot: 'bg-surface-500' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-1.5">
                        <span className={cn('h-2 w-2 rounded-full flex-shrink-0', item.dot)} />
                        <span className={cn('font-mono text-xs', item.color)}>
                          {item.label}: <strong>{item.val.toLocaleString()}</strong>
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Mini bar chart */}
                  {data.metrics.topics.total > 0 && (() => {
                    const total = data.metrics.topics.total
                    const segments = [
                      { pct: (data.metrics.topics.proposed / total) * 100, color: 'bg-surface-400' },
                      { pct: (data.metrics.topics.active / total) * 100, color: 'bg-for-500' },
                      { pct: (data.metrics.topics.voting / total) * 100, color: 'bg-purple' },
                      { pct: (data.metrics.topics.laws / total) * 100, color: 'bg-gold' },
                      { pct: (data.metrics.topics.failed / total) * 100, color: 'bg-surface-500' },
                    ]
                    return (
                      <div className="mt-3 flex h-2 rounded-full overflow-hidden gap-px">
                        {segments.map((seg, i) =>
                          seg.pct > 0 ? (
                            <div
                              key={i}
                              className={cn('h-full transition-all duration-700', seg.color)}
                              style={{ width: `${seg.pct}%` }}
                            />
                          ) : null,
                        )}
                      </div>
                    )
                  })()}
                </div>
              </section>

              {/* Components */}
              <section>
                <h2 className="font-mono text-xs font-bold text-surface-500 uppercase tracking-widest mb-3">
                  System Components
                </h2>
                <div className="rounded-2xl bg-surface-100 border border-surface-300 px-5">
                  {data.components.map((comp) => (
                    <ComponentRow key={comp.name} component={comp} />
                  ))}
                </div>
              </section>

              {/* Recent Events */}
              {data.recent_events.length > 0 && (
                <section>
                  <h2 className="font-mono text-xs font-bold text-surface-500 uppercase tracking-widest mb-3">
                    Recent Platform Events
                  </h2>
                  <div className="rounded-2xl bg-surface-100 border border-surface-300 px-5 py-1">
                    {data.recent_events.map((event, i) => (
                      <EventItem key={`${event.type}-${event.id}-${i}`} event={event} />
                    ))}
                  </div>
                </section>
              )}

              {/* Footer links */}
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex flex-wrap gap-3">
                <Link
                  href="/api-explorer"
                  className="flex items-center gap-2 text-surface-400 hover:text-white font-mono text-xs transition-colors"
                >
                  <Globe className="h-3.5 w-3.5" />
                  API Explorer
                </Link>
                <Link
                  href="/developers"
                  className="flex items-center gap-2 text-surface-400 hover:text-white font-mono text-xs transition-colors"
                >
                  <Server className="h-3.5 w-3.5" />
                  Developer Docs
                </Link>
                <Link
                  href="/changelog"
                  className="flex items-center gap-2 text-surface-400 hover:text-white font-mono text-xs transition-colors"
                >
                  <Activity className="h-3.5 w-3.5" />
                  Changelog
                </Link>
                <a
                  href="/api/status"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-surface-400 hover:text-white font-mono text-xs transition-colors"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  Raw JSON
                </a>
              </div>
            </motion.div>
          </AnimatePresence>
        ) : null}
      </main>
      <BottomNav />
    </div>
  )
}
