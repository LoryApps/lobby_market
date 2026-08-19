'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
  Gavel,
  Loader2,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Zap,
  XCircle,
  Minus,
  Target,
  Info,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ForecastResponse, ForecastTopic, ForecastOutcome } from '@/app/api/civic-forecast/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return `${Math.floor(d / 7)}w ago`
}

function formatHours(h: number | null): string {
  if (h === null) return '—'
  if (h < 1) return `${Math.round(h * 60)}m`
  if (h < 24) return `${Math.round(h)}h`
  return `${Math.round(h / 24)}d`
}

// ─── Outcome config ───────────────────────────────────────────────────────────

const OUTCOME_CONFIG: Record<ForecastOutcome, {
  label: string
  color: string
  bg: string
  border: string
  icon: typeof CheckCircle2
}> = {
  likely_law: {
    label: 'Likely Law',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    icon: Gavel,
  },
  possible_law: {
    label: 'Possible Law',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    icon: TrendingUp,
  },
  contested: {
    label: 'Contested',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    icon: Scale,
  },
  likely_fail: {
    label: 'Likely Fail',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    icon: TrendingDown,
  },
  certain_fail: {
    label: 'Failing',
    color: 'text-against-500',
    bg: 'bg-against-500/15',
    border: 'border-against-500/40',
    icon: XCircle,
  },
}

const MOMENTUM_CONFIG: Record<string, { icon: typeof TrendingUp; color: string; label: string }> = {
  surging:  { icon: TrendingUp,   color: 'text-emerald',     label: 'Surging' },
  stable:   { icon: Minus,        color: 'text-surface-500', label: 'Stable' },
  fading:   { icon: TrendingDown, color: 'text-against-400', label: 'Fading' },
  unknown:  { icon: Activity,     color: 'text-surface-500', label: 'New' },
}

// ─── Mini sparkline ───────────────────────────────────────────────────────────

function Sparkline({ history, height = 24 }: {
  history: ForecastTopic['price_history']
  height?: number
}) {
  if (history.length < 2) return null
  const pts = [...history].reverse()
  const min = Math.min(...pts.map((p) => p.price))
  const max = Math.max(...pts.map((p) => p.price))
  const range = Math.max(max - min, 5)
  const w = 60
  const h = height
  const pad = 2

  const pathD = pts
    .map((p, i) => {
      const x = pad + (i / (pts.length - 1)) * (w - pad * 2)
      const y = h - pad - ((p.price - min) / range) * (h - pad * 2)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const last = pts[pts.length - 1].price
  const first = pts[0].price
  const up = last >= first
  const stroke = up ? '#3b82f6' : '#ef4444'

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="shrink-0">
      <path d={pathD} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
    </svg>
  )
}

// ─── Probability bar ──────────────────────────────────────────────────────────

function ProbBar({ prob, outcome }: { prob: number; outcome: ForecastOutcome }) {
  const cfg = OUTCOME_CONFIG[outcome]
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', cfg.bg.replace('/10', '/60').replace('/15', '/60'))}
          style={{ backgroundColor: undefined }}
          initial={{ width: 0 }}
          animate={{ width: `${prob}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className={cn('text-xs font-mono font-bold tabular-nums w-8 text-right', cfg.color)}>
        {Math.round(prob)}%
      </span>
    </div>
  )
}

// ─── Confidence pip ───────────────────────────────────────────────────────────

function ConfidencePips({ confidence }: { confidence: number }) {
  const filled = Math.round(confidence / 20)
  return (
    <div className="flex items-center gap-0.5" title={`${confidence}% confidence`}>
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className={cn(
            'w-1 h-2.5 rounded-full',
            i < filled ? 'bg-surface-600' : 'bg-surface-300',
          )}
        />
      ))}
    </div>
  )
}

// ─── Forecast card ────────────────────────────────────────────────────────────

function ForecastCard({ topic, rank }: { topic: ForecastTopic; rank?: number }) {
  const outcomeConfig = OUTCOME_CONFIG[topic.outcome]
  const OutcomeIcon = outcomeConfig.icon
  const momentumCfg = MOMENTUM_CONFIG[topic.momentum_label] ?? MOMENTUM_CONFIG.unknown
  const MomIcon = momentumCfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'block rounded-xl border bg-surface-100 p-4',
          'hover:bg-surface-200 transition-colors group',
          topic.swing_risk ? 'border-gold/30' : 'border-surface-300',
        )}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {rank !== undefined && (
                <span className="text-xs font-mono text-surface-500">#{rank + 1}</span>
              )}
              {topic.category && (
                <Badge variant="proposed" className="text-[10px] px-1.5 py-0">
                  {topic.category}
                </Badge>
              )}
              {topic.swing_risk && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-gold bg-gold/10 border border-gold/30 rounded-full px-1.5 py-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  Swing
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-surface-800 leading-snug line-clamp-2 group-hover:text-white transition-colors">
              {topic.statement}
            </p>
          </div>

          <div className="shrink-0 flex flex-col items-end gap-1.5">
            <span className={cn('flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 border', outcomeConfig.bg, outcomeConfig.color, outcomeConfig.border)}>
              <OutcomeIcon className="h-3 w-3" />
              {outcomeConfig.label}
            </span>
            <ConfidencePips confidence={topic.confidence} />
          </div>
        </div>

        {/* Probability bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-surface-500">Law probability</span>
            <div className="flex items-center gap-2">
              <span className={cn('flex items-center gap-0.5 text-[10px]', momentumCfg.color)}>
                <MomIcon className="h-2.5 w-2.5" />
                {momentumCfg.label}
              </span>
            </div>
          </div>
          <ProbBar prob={topic.law_probability} outcome={topic.outcome} />
        </div>

        {/* Stats footer */}
        <div className="flex items-center justify-between text-[11px] text-surface-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="text-for-400 font-mono font-medium">{Math.round(topic.blue_pct)}%</span>
              <span>FOR</span>
            </span>
            <span className="flex items-center gap-1">
              <BarChart2 className="h-3 w-3" />
              {topic.total_votes.toLocaleString()} votes
            </span>
          </div>
          <div className="flex items-center gap-3">
            {topic.hours_remaining !== null && (
              <span className={cn('flex items-center gap-1', topic.hours_remaining < 6 && 'text-gold')}>
                <Clock className="h-3 w-3" />
                {formatHours(topic.hours_remaining)} left
              </span>
            )}
            {topic.price_history.length >= 2 && (
              <Sparkline history={topic.price_history} />
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  icon: Icon,
  iconColor,
  topics,
  emptyLabel,
  loading,
}: {
  title: string
  subtitle: string
  icon: typeof Gavel
  iconColor: string
  topics: ForecastTopic[]
  emptyLabel: string
  loading: boolean
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn('h-4 w-4', iconColor)} />
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <p className="text-xs text-surface-500">{subtitle}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : topics.length === 0 ? (
        <EmptyState
          icon={Icon}
          title={emptyLabel}
          description="Check back as more topics enter this stage."
          className="py-6"
        />
      ) : (
        <div className="space-y-2">
          {topics.map((t, i) => (
            <ForecastCard key={t.id} topic={t} rank={i} />
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({ label, value, icon: Icon, color }: {
  label: string
  value: string | number
  icon: typeof Activity
  color: string
}) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 flex items-center gap-3">
      <div className={cn('rounded-lg p-2', color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-lg font-bold text-white font-mono tabular-nums leading-none">{value}</p>
        <p className="text-xs text-surface-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type TabId = 'law_candidates' | 'contested' | 'at_risk' | 'active_movers'

const TABS: { id: TabId; label: string; icon: typeof Gavel }[] = [
  { id: 'law_candidates', label: 'On Track', icon: Gavel },
  { id: 'contested', label: 'Contested', icon: Scale },
  { id: 'at_risk', label: 'At Risk', icon: AlertTriangle },
  { id: 'active_movers', label: 'Movers', icon: Flame },
]

export function ForecastClient() {
  const [data, setData] = useState<ForecastResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('law_candidates')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/civic-forecast', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load forecast')
      const json: ForecastResponse = await res.json()
      setData(json)
    } catch {
      setError('Unable to load forecast data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const stats = data?.stats

  const tabTopics: Record<TabId, ForecastTopic[]> = {
    law_candidates: data?.law_candidates ?? [],
    contested: data?.contested ?? [],
    at_risk: data?.at_risk ?? [],
    active_movers: data?.active_movers ?? [],
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-10 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Target className="h-5 w-5 text-purple" />
              Civic Forecast
            </h1>
            <p className="text-sm text-surface-500 mt-0.5">
              Predictive outlook for active topics — which debates are on track to become law?
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="shrink-0 flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Methodology note */}
        <div className="flex items-start gap-2 rounded-xl border border-surface-300 bg-surface-100 px-3 py-2.5">
          <Info className="h-3.5 w-3.5 text-surface-500 mt-0.5 shrink-0" />
          <p className="text-xs text-surface-500 leading-relaxed">
            Forecast uses current vote split, momentum, engagement depth, and voting phase timing.
            High confidence = 70%+ signal clarity. Swing topics are within 5pp of 50/50.
          </p>
        </div>

        {/* Stats row */}
        {!loading && stats && (
          <div className="grid grid-cols-2 gap-2">
            <StatTile
              label="Active topics"
              value={stats.total_active}
              icon={Zap}
              color="bg-for-500/10 text-for-400"
            />
            <StatTile
              label="In voting"
              value={stats.total_voting}
              icon={Scale}
              color="bg-purple/10 text-purple"
            />
            <StatTile
              label="Avg law probability"
              value={`${stats.avg_law_probability}%`}
              icon={Target}
              color="bg-gold/10 text-gold"
            />
            <StatTile
              label="High-confidence signals"
              value={stats.high_confidence_count}
              icon={Activity}
              color="bg-emerald/10 text-emerald"
            />
          </div>
        )}
        {loading && (
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-surface-200 p-1 overflow-x-auto no-scrollbar">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors flex-1 justify-center',
                tab === id
                  ? 'bg-surface-50 text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-700',
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
              {!loading && data && (
                <span className={cn('text-[10px] font-mono', tab === id ? 'text-surface-600' : 'text-surface-400')}>
                  {tabTopics[id].length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-against-500/10 border border-against-500/30 px-4 py-3 text-sm text-against-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {tab === 'law_candidates' && (
              <Section
                title="On Track for Law"
                subtitle="Voting-phase topics with ≥55% law probability"
                icon={Gavel}
                iconColor="text-emerald"
                topics={tabTopics.law_candidates}
                emptyLabel="No voting-phase topics on track yet"
                loading={loading}
              />
            )}
            {tab === 'contested' && (
              <Section
                title="Contested Outcomes"
                subtitle="Swing topics and uncertain debates"
                icon={Scale}
                iconColor="text-gold"
                topics={tabTopics.contested}
                emptyLabel="No contested topics right now"
                loading={loading}
              />
            )}
            {tab === 'at_risk' && (
              <Section
                title="At Risk of Failing"
                subtitle="Voting topics trending toward rejection"
                icon={AlertTriangle}
                iconColor="text-against-400"
                topics={tabTopics.at_risk}
                emptyLabel="No topics flagged as at-risk"
                loading={loading}
              />
            )}
            {tab === 'active_movers' && (
              <Section
                title="Momentum Surging"
                subtitle="Active topics gaining consensus fast"
                icon={Flame}
                iconColor="text-gold"
                topics={tabTopics.active_movers}
                emptyLabel="No surging topics detected"
                loading={loading}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Updated at */}
        {data && (
          <p className="text-center text-xs text-surface-400">
            Forecast generated {relTime(data.generated_at)}
            {' · '}
            <Link href="/exchange" className="hover:text-surface-600 transition-colors underline underline-offset-2">
              View Exchange
            </Link>
            {' · '}
            <Link href="/predictions" className="hover:text-surface-600 transition-colors underline underline-offset-2">
              Your Predictions
            </Link>
          </p>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
