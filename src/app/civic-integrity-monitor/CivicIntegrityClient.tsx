'use client'

/**
 * /civic-integrity-monitor — Platform Integrity & Health Dashboard
 *
 * Transparent view of platform health for all citizens:
 *   • Live health score (0–100) from the latest daily snapshot
 *   • 30-day sparkline trend of health, votes, and flagged activity
 *   • Integrity signal feed: vote clusters, coordinated swings, sock puppets, etc.
 *   • Filter tabs: Active signals | Resolved | All
 *   • Admins/moderators can resolve signals inline
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Eye,
  Flame,
  Loader2,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { IntegrityResponse, IntegritySignal, IntegritySnapshot } from '@/app/api/civic-integrity-monitor/route'

// ─── Config ───────────────────────────────────────────────────────────────────

type FilterTab = 'active' | 'resolved' | 'all'

const SIGNAL_LABELS: Record<IntegritySignal['signal_type'], string> = {
  vote_cluster:       'Vote Cluster',
  coordinated_swing:  'Coordinated Swing',
  sock_puppet:        'Sock Puppet',
  topic_spam:         'Topic Spam',
  argument_flood:     'Argument Flood',
}

const SIGNAL_ICONS: Record<IntegritySignal['signal_type'], React.ComponentType<{ className?: string }>> = {
  vote_cluster:       Vote,
  coordinated_swing:  Users,
  sock_puppet:        Eye,
  topic_spam:         Flame,
  argument_flood:     Activity,
}

const SEVERITY_CONFIG: Record<IntegritySignal['severity'], {
  label: string
  bg: string
  border: string
  text: string
  dot: string
}> = {
  low:      { label: 'Low',      bg: 'bg-surface-200/60', border: 'border-surface-400/40', text: 'text-surface-400', dot: 'bg-surface-400' },
  medium:   { label: 'Medium',   bg: 'bg-gold/10',        border: 'border-gold/30',        text: 'text-gold',        dot: 'bg-gold' },
  high:     { label: 'High',     bg: 'bg-against-500/10', border: 'border-against-500/30', text: 'text-against-400', dot: 'bg-against-400' },
  critical: { label: 'Critical', bg: 'bg-against-500/20', border: 'border-against-400/50', text: 'text-against-300', dot: 'bg-against-300' },
}

function healthColor(score: number): string {
  if (score >= 90) return 'text-emerald'
  if (score >= 75) return 'text-gold'
  if (score >= 60) return 'text-against-400'
  return 'text-against-300'
}

function healthLabel(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 75) return 'Good'
  if (score >= 60) return 'Fair'
  return 'At Risk'
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return 'just now'
}

// ─── Mini Sparkline ───────────────────────────────────────────────────────────

function HealthSparkline({ snapshots }: { snapshots: IntegritySnapshot[] }) {
  if (snapshots.length < 2) return null

  const scores = snapshots.map((s) => s.health_score)
  const min = Math.min(...scores) - 2
  const max = Math.max(...scores) + 2
  const range = max - min || 1

  const W = 240
  const H = 60
  const pad = 4

  const points = scores.map((s, i) => {
    const x = pad + (i / (scores.length - 1)) * (W - pad * 2)
    const y = H - pad - ((s - min) / range) * (H - pad * 2)
    return `${x},${y}`
  })

  const latest = scores[scores.length - 1]
  const lx = pad + ((scores.length - 1) / (scores.length - 1)) * (W - pad * 2)
  const ly = H - pad - ((latest - min) / range) * (H - pad * 2)

  const strokeColor = latest >= 90 ? '#10b981' : latest >= 75 ? '#f59e0b' : '#ef4444'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14" preserveAspectRatio="none">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
      />
      <circle cx={lx} cy={ly} r={3.5} fill={strokeColor} />
    </svg>
  )
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  color: string
  sub?: string
}) {
  return (
    <div className="flex flex-col gap-1 p-4 rounded-2xl bg-surface-100 border border-surface-300/40">
      <div className={cn('flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider', color)}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="font-mono text-2xl font-bold text-white tabular-nums">{value}</p>
      {sub && <p className="font-mono text-[11px] text-surface-500">{sub}</p>}
    </div>
  )
}

// ─── Signal card ──────────────────────────────────────────────────────────────

function SignalCard({
  signal,
  isAdmin,
  onResolve,
  resolving,
}: {
  signal: IntegritySignal
  isAdmin: boolean
  onResolve: (id: string) => void
  resolving: string | null
}) {
  const sev = SEVERITY_CONFIG[signal.severity]
  const Icon = SIGNAL_ICONS[signal.signal_type]
  const note = (signal.details as { note?: string }).note
  const topicTitle = (signal.details as { topic_title?: string }).topic_title

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn(
        'flex items-start gap-3 p-4 rounded-2xl border transition-colors',
        signal.resolved
          ? 'bg-surface-100/40 border-surface-300/20 opacity-60'
          : 'bg-surface-100 border-surface-300/40 hover:border-surface-400/60'
      )}
    >
      {/* Icon */}
      <div className={cn('flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl border', sev.bg, sev.border)}>
        <Icon className={cn('h-4.5 w-4.5', sev.text)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-semibold text-white">
            {SIGNAL_LABELS[signal.signal_type]}
          </span>
          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border', sev.bg, sev.border, sev.text)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', sev.dot)} />
            {sev.label}
          </span>
          {signal.resolved && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-emerald border border-emerald/30 bg-emerald/10">
              <CheckCircle2 className="h-3 w-3" />
              Resolved
            </span>
          )}
        </div>
        {note && (
          <p className="mt-1 text-xs font-mono text-surface-400 leading-relaxed">{note}</p>
        )}
        {topicTitle && (
          <p className="mt-0.5 text-[11px] font-mono text-surface-600 italic">
            Re: &ldquo;{topicTitle}&rdquo;
          </p>
        )}
        <p className="mt-1 text-[11px] font-mono text-surface-600">
          {relativeTime(signal.created_at)}
          {signal.resolved_at && ` · resolved ${relativeTime(signal.resolved_at)}`}
        </p>
      </div>

      {/* Resolve button (admin only, active only) */}
      {isAdmin && !signal.resolved && (
        <button
          onClick={() => onResolve(signal.id)}
          disabled={resolving === signal.id}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold text-emerald border border-emerald/30 bg-emerald/10 hover:bg-emerald/20 transition-colors disabled:opacity-50"
        >
          {resolving === signal.id
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <Check className="h-3 w-3" />}
          Resolve
        </button>
      )}
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function IntegritySkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-surface-100 animate-pulse" />
        ))}
      </div>
      <div className="h-28 rounded-2xl bg-surface-100 animate-pulse" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-20 rounded-2xl bg-surface-100 animate-pulse" />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CivicIntegrityClient() {
  const [data, setData] = useState<IntegrityResponse | null>(null)
  const [filter, setFilter] = useState<FilterTab>('active')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [resolving, setResolving] = useState<string | null>(null)
  const [isAdmin] = useState(false) // TODO: derive from session if needed
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async (tab: FilterTab, isRefresh = false) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const res = await fetch(`/api/civic-integrity-monitor?filter=${tab}`, {
        signal: ctrl.signal,
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as IntegrityResponse
      setData(json)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') console.error(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load(filter)
  }, [filter, load])

  async function handleResolve(signalId: string) {
    setResolving(signalId)
    try {
      await fetch('/api/civic-integrity-monitor', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId }),
      })
      await load(filter, true)
    } finally {
      setResolving(null)
    }
  }

  const latest = data?.snapshots.at(-1) ?? null
  const prev = data?.snapshots.at(-2) ?? null
  const healthDelta = latest && prev ? latest.health_score - prev.health_score : null

  return (
    <div className="min-h-screen bg-surface-950 text-white">
      <TopBar title="Integrity Monitor" />

      <main className="max-w-2xl mx-auto px-4 pt-4 pb-32 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/15 border border-for-500/30">
            <ShieldCheck className="h-5 w-5 text-for-400" />
          </div>
          <div>
            <h1 className="font-mono text-lg font-bold text-white">Civic Integrity Monitor</h1>
            <p className="font-mono text-xs text-surface-500">
              Platform health · vote-pattern signals · transparency
            </p>
          </div>
          <button
            onClick={() => load(filter, true)}
            disabled={refreshing}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-400 border border-surface-300/40 hover:border-surface-400 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {loading ? (
          <IntegritySkeleton />
        ) : !data ? (
          <EmptyState
            icon={ShieldAlert}
            title="Monitor unavailable"
            description="Could not load integrity data. Try refreshing."
            action={{ label: 'Retry', onClick: () => load(filter) }}
          />
        ) : (
          <>
            {/* Health score + stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-surface-100 border border-surface-300/40 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 uppercase tracking-wider">
                  <Shield className="h-3.5 w-3.5" />
                  Health Score
                </div>
                <p className={cn('font-mono text-4xl font-bold tabular-nums leading-none', healthColor(data.latestHealth))}>
                  {data.latestHealth.toFixed(1)}
                </p>
                <div className="flex items-center gap-2">
                  <span className={cn('text-[11px] font-mono font-semibold', healthColor(data.latestHealth))}>
                    {healthLabel(data.latestHealth)}
                  </span>
                  {healthDelta !== null && (
                    <span className={cn('text-[11px] font-mono', healthDelta >= 0 ? 'text-emerald' : 'text-against-400')}>
                      {healthDelta >= 0 ? '+' : ''}{healthDelta.toFixed(1)} vs yesterday
                    </span>
                  )}
                </div>
              </div>

              <StatTile
                label="Active Signals"
                value={data.activeSignalCount}
                icon={AlertTriangle}
                color={data.activeSignalCount > 5 ? 'text-against-400' : 'text-gold'}
                sub={data.activeSignalCount === 0 ? 'All clear' : 'Needs review'}
              />

              {latest && (
                <>
                  <StatTile
                    label="Votes Today"
                    value={latest.total_votes.toLocaleString()}
                    icon={Vote}
                    color="text-for-400"
                    sub={`${latest.unique_voters.toLocaleString()} unique voters`}
                  />
                  <StatTile
                    label="Flagged"
                    value={latest.flagged_votes.toLocaleString()}
                    icon={Zap}
                    color={latest.flagged_votes > 50 ? 'text-against-400' : 'text-surface-400'}
                    sub={`of ${latest.total_votes} votes`}
                  />
                </>
              )}
            </div>

            {/* 30-day sparkline */}
            {data.snapshots.length > 1 && (
              <div className="p-4 rounded-2xl bg-surface-100 border border-surface-300/40">
                <p className="font-mono text-[11px] text-surface-500 uppercase tracking-wider mb-3">
                  30-Day Health Trend
                </p>
                <HealthSparkline snapshots={data.snapshots} />
                <div className="flex items-center justify-between mt-2">
                  <span className="font-mono text-[10px] text-surface-600">
                    {data.snapshots[0]?.snapshot_date?.slice(5) ?? ''}
                  </span>
                  <span className="font-mono text-[10px] text-surface-600">Today</span>
                </div>
              </div>
            )}

            {/* Filter tabs */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-100 border border-surface-300/40 w-fit">
              {(['active', 'resolved', 'all'] as FilterTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold capitalize transition-all',
                    filter === tab
                      ? 'bg-for-500/20 text-for-300 border border-for-500/30'
                      : 'text-surface-500 hover:text-white'
                  )}
                >
                  {tab}
                  {tab === 'active' && data.activeSignalCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 rounded-full text-[9px] bg-against-500/20 text-against-400 border border-against-500/30 px-1">
                      {data.activeSignalCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Signal feed */}
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {data.signals.length === 0 ? (
                  <EmptyState
                    key="empty"
                    icon={ShieldCheck}
                    title={filter === 'active' ? 'No active signals' : 'No signals found'}
                    description={
                      filter === 'active'
                        ? 'Platform integrity looks healthy — no flagged patterns right now.'
                        : 'No signals match this filter.'
                    }
                    size="sm"
                  />
                ) : (
                  data.signals.map((signal) => (
                    <SignalCard
                      key={signal.id}
                      signal={signal}
                      isAdmin={isAdmin}
                      onResolve={handleResolve}
                      resolving={resolving}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>

            {/* Footer note */}
            <p className="font-mono text-[11px] text-surface-600 text-center leading-relaxed">
              Integrity signals are generated automatically. All data is public for platform transparency.
              {' '}Signal resolution is performed by community moderators.
            </p>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
