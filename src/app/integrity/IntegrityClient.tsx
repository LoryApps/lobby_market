'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Users,
  Vote,
  Flag,
  BarChart2,
  RefreshCw,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

// ── Types ────────────────────────────────────────────────────────────────────

type Snapshot = {
  id: string
  snapshot_date: string
  total_votes: number
  unique_voters: number
  flagged_votes: number
  new_topics: number
  rejected_topics: number
  new_users: number
  active_signals: number
  health_score: number
}

type Signal = {
  id: string
  signal_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  details: Record<string, string>
  resolved: boolean
  created_at: string
}

type SeverityCounts = { low: number; medium: number; high: number; critical: number }

type OverviewData = {
  snapshots: Snapshot[]
  activeSeverityCounts: SeverityCounts
  latestSnapshot: Snapshot | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<string, string> = {
  low: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  medium: 'text-gold bg-gold/10 border-gold/20',
  high: 'text-against-400 bg-against-400/10 border-against-400/20',
  critical: 'text-against-500 bg-against-500/20 border-against-500/40',
}

const SIGNAL_LABELS: Record<string, string> = {
  vote_cluster: 'Vote Cluster',
  coordinated_swing: 'Coordinated Swing',
  sock_puppet: 'Sock Puppet',
  topic_spam: 'Topic Spam',
  argument_flood: 'Argument Flood',
}

function healthColor(score: number) {
  if (score >= 90) return 'text-emerald-400'
  if (score >= 75) return 'text-gold'
  if (score >= 60) return 'text-against-400'
  return 'text-against-500'
}

function HealthIcon({ score }: { score: number }) {
  if (score >= 90) return <ShieldCheck className="w-6 h-6 text-emerald-400" />
  if (score >= 75) return <ShieldAlert className="w-6 h-6 text-gold" />
  return <ShieldX className="w-6 h-6 text-against-400" />
}

// ── Mini sparkline (pure CSS bars) ───────────────────────────────────────────

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)
  return (
    <div className="flex items-end gap-0.5 h-10 w-full">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t transition-all duration-300"
          style={{
            height: `${Math.max(4, (v / max) * 40)}px`,
            backgroundColor:
              v / max > 0.85
                ? '#4ade80'
                : v / max > 0.6
                ? '#f59e0b'
                : '#f87171',
            opacity: 0.7 + (i / values.length) * 0.3,
          }}
        />
      ))}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  trend,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  trend?: 'up' | 'down' | 'neutral'
}) {
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-surface-400 text-xs">
        {icon}
        <span>{label}</span>
        {trend === 'up' && <TrendingUp className="w-3 h-3 text-emerald-400 ml-auto" />}
        {trend === 'down' && <TrendingDown className="w-3 h-3 text-against-400 ml-auto" />}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-surface-400">{sub}</div>}
    </div>
  )
}

// ── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: OverviewData }) {
  const { snapshots, activeSeverityCounts, latestSnapshot } = data
  const healthValues = snapshots.map((s) => s.health_score)
  const totalActive =
    activeSeverityCounts.low +
    activeSeverityCounts.medium +
    activeSeverityCounts.high +
    activeSeverityCounts.critical

  const avgHealth =
    healthValues.length > 0
      ? healthValues.reduce((a, b) => a + b, 0) / healthValues.length
      : 0

  return (
    <div className="space-y-5">
      {/* Health score hero */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          {latestSnapshot && <HealthIcon score={latestSnapshot.health_score} />}
          <div>
            <div className="text-xs text-surface-400 uppercase tracking-widest">Platform Health</div>
            <div className={`text-4xl font-bold ${latestSnapshot ? healthColor(latestSnapshot.health_score) : 'text-white'}`}>
              {latestSnapshot ? `${latestSnapshot.health_score.toFixed(1)}%` : '—'}
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs text-surface-400">30-day avg</div>
            <div className="text-lg font-semibold text-surface-200">{avgHealth.toFixed(1)}%</div>
          </div>
        </div>
        <Sparkline values={healthValues} />
        <div className="flex justify-between mt-1 text-xs text-surface-500">
          <span>30 days ago</span>
          <span>Today</span>
        </div>
      </div>

      {/* Stats grid */}
      {latestSnapshot && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<Vote className="w-3.5 h-3.5" />}
            label="Votes Today"
            value={latestSnapshot.total_votes.toLocaleString()}
            sub={`${latestSnapshot.unique_voters.toLocaleString()} unique voters`}
            trend="up"
          />
          <StatCard
            icon={<Flag className="w-3.5 h-3.5 text-against-400" />}
            label="Flagged Votes"
            value={latestSnapshot.flagged_votes}
            sub={`${((latestSnapshot.flagged_votes / Math.max(latestSnapshot.total_votes, 1)) * 100).toFixed(2)}% of total`}
            trend={latestSnapshot.flagged_votes > 20 ? 'down' : 'neutral'}
          />
          <StatCard
            icon={<BarChart2 className="w-3.5 h-3.5" />}
            label="New Topics"
            value={latestSnapshot.new_topics}
            sub={`${latestSnapshot.rejected_topics} rejected`}
          />
          <StatCard
            icon={<Users className="w-3.5 h-3.5 text-for-400" />}
            label="New Citizens"
            value={latestSnapshot.new_users}
            sub="joined today"
            trend="up"
          />
        </div>
      )}

      {/* Active signals summary */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <AlertTriangle className="w-4 h-4 text-gold" />
            Active Signals
          </div>
          <span className="text-xs text-surface-400">{totalActive} open</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {(['critical', 'high', 'medium', 'low'] as const).map((sev) => (
            <div key={sev} className={`rounded-lg border p-2 text-center ${SEVERITY_COLOR[sev]}`}>
              <div className="text-xl font-bold">{activeSeverityCounts[sev]}</div>
              <div className="text-xs capitalize opacity-80">{sev}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Signals tab ───────────────────────────────────────────────────────────────

function SignalRow({ signal }: { signal: Signal }) {
  const date = new Date(signal.created_at)
  const timeAgo = (() => {
    const diff = Date.now() - date.getTime()
    const h = Math.floor(diff / 3600000)
    const d = Math.floor(h / 24)
    if (d > 0) return `${d}d ago`
    if (h > 0) return `${h}h ago`
    return 'just now'
  })()

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-800 border border-surface-700 rounded-xl p-4 space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${SEVERITY_COLOR[signal.severity]}`}>
            {signal.severity.toUpperCase()}
          </span>
          <span className="text-sm font-medium text-white">
            {SIGNAL_LABELS[signal.signal_type] ?? signal.signal_type}
          </span>
        </div>
        {signal.resolved ? (
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
        ) : (
          <Activity className="w-4 h-4 text-gold shrink-0 animate-pulse" />
        )}
      </div>
      {signal.details?.note && (
        <p className="text-sm text-surface-300 leading-relaxed">{signal.details.note}</p>
      )}
      {signal.details?.topic_title && (
        <div className="text-xs text-surface-400">
          Topic: <span className="text-surface-200">{signal.details.topic_title}</span>
        </div>
      )}
      <div className="text-xs text-surface-500">{timeAgo}</div>
    </motion.div>
  )
}

function SignalsTab() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [severity, setSeverity] = useState('all')
  const [resolved, setResolved] = useState('false')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(
      `/api/integrity?tab=signals&severity=${severity}&resolved=${resolved}`
    )
    const data = await res.json()
    setSignals(data.signals ?? [])
    setLoading(false)
  }, [severity, resolved])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'critical', 'high', 'medium', 'low'].map((s) => (
          <button
            key={s}
            onClick={() => setSeverity(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              severity === s
                ? 'bg-for-500 border-for-500 text-white'
                : 'border-surface-600 text-surface-400 hover:border-surface-400'
            }`}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <button
          onClick={() => setResolved(resolved === 'false' ? 'all' : 'false')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ml-auto ${
            resolved === 'all'
              ? 'bg-surface-600 border-surface-600 text-white'
              : 'border-surface-600 text-surface-400 hover:border-surface-400'
          }`}
        >
          {resolved === 'all' ? 'All (incl. resolved)' : 'Active only'}
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : signals.length === 0 ? (
        <div className="text-center py-16 text-surface-400">
          <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
          <div className="text-sm">No signals match these filters</div>
        </div>
      ) : (
        <AnimatePresence>
          {signals.map((s) => (
            <SignalRow key={s.id} signal={s} />
          ))}
        </AnimatePresence>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
  { id: 'signals', label: 'Signals', icon: <AlertTriangle className="w-4 h-4" /> },
] as const

type TabId = (typeof TABS)[number]['id']

export default function IntegrityClient() {
  const [tab, setTab] = useState<TabId>('overview')
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [loadingOverview, setLoadingOverview] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadOverview = useCallback(async () => {
    setRefreshing(true)
    const res = await fetch('/api/integrity?tab=overview')
    const data = await res.json()
    setOverview(data)
    setLoadingOverview(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      <TopBar />

      <main className="flex-1 overflow-y-auto pb-24">
        {/* Header */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-for-400" />
              Civic Integrity Monitor
            </h1>
            <button
              onClick={loadOverview}
              disabled={refreshing}
              className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-700 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-xs text-surface-400">
            Platform health, vote-pattern analysis, and coordinated-activity detection.
          </p>
        </div>

        {/* Tabs */}
        <div className="px-4 pt-2 pb-1">
          <div className="flex gap-1 bg-surface-800 rounded-xl p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-lg font-medium transition-colors ${
                  tab === t.id
                    ? 'bg-for-600 text-white'
                    : 'text-surface-400 hover:text-white'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 pt-3">
          <AnimatePresence mode="wait">
            {tab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                {loadingOverview ? (
                  <div className="space-y-3">
                    <Skeleton className="h-36 rounded-xl" />
                    <div className="grid grid-cols-2 gap-3">
                      {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-24 rounded-xl" />
                      ))}
                    </div>
                    <Skeleton className="h-28 rounded-xl" />
                  </div>
                ) : overview ? (
                  <OverviewTab data={overview} />
                ) : null}
              </motion.div>
            )}

            {tab === 'signals' && (
              <motion.div
                key="signals"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                <SignalsTab />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
