'use client'

/**
 * /rebound — The Civic Rebound Index
 *
 * Identifies topics that went dormant — low or zero vote activity for
 * 7–30 days — and are now experiencing a resurgence of engagement.
 * These are the debates that refuse to stay settled.
 *
 * Rebound Ratio = recent_24h_votes / dormant_daily_avg (days 8–30 ago)
 *
 * Classes:
 *   Phoenix  (≥5×) — once-dead topic ignites back to life
 *   Revival  (2–5×) — quiet debate finds renewed urgency
 *   Stir     (1.2–2×) — subtle awakening, momentum building
 *
 * Distinct from:
 *   /tremor      — direction shift from historical baseline (not dormancy)
 *   /momentum    — raw vote velocity (no dormancy requirement)
 *   /surge       — proximity to activation thresholds
 *   /seismic     — sudden activity spikes on ANY topic
 *   /inflection  — topics approaching vote threshold
 *
 * Only Rebound answers: "What was dead that's alive again?"
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart2,
  ChevronDown,
  Cpu,
  Flame,
  FlaskConical,
  GraduationCap,
  Heart,
  Info,
  Landmark,
  Leaf,
  Loader2,
  Music2,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  ReboundClass,
  ReboundResponse,
  ReboundTopic,
  CategoryRebound,
} from '@/app/api/rebound/route'

// ─── Category icons ───────────────────────────────────────────────────────────

const CAT_ICON: Record<string, typeof Activity> = {
  Politics: Landmark,
  Economics: TrendingUp,
  Technology: Cpu,
  Science: FlaskConical,
  Ethics: Scale,
  Philosophy: Scale,
  Culture: Music2,
  Health: Heart,
  Environment: Leaf,
  Education: GraduationCap,
}

// ─── Rebound class config ─────────────────────────────────────────────────────

const CLASS_CONFIG: Record<
  ReboundClass,
  {
    label: string
    icon: typeof Flame
    color: string
    bg: string
    border: string
    badgeClass: string
    desc: string
    ratioLabel: string
  }
> = {
  phoenix: {
    label: 'Phoenix',
    icon: Flame,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    badgeClass: 'bg-gold/15 border-gold/30 text-gold',
    desc: 'Effectively dormant — now roaring back at 5× or more its quiet baseline',
    ratioLabel: '≥5× baseline',
  },
  revival: {
    label: 'Revival',
    icon: Sparkles,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    badgeClass: 'bg-emerald/15 border-emerald/30 text-emerald',
    desc: 'Noticeably quiet debate now seeing 2–5× its dormancy-period daily average',
    ratioLabel: '2–5× baseline',
  },
  stir: {
    label: 'Stir',
    icon: Activity,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    badgeClass: 'bg-purple/15 border-purple/30 text-purple',
    desc: 'Subtle awakening — 1.2–2× above its quiet-period baseline',
    ratioLabel: '1.2–2× baseline',
  },
}

const CLASS_ORDER: ReboundClass[] = ['phoenix', 'revival', 'stir']
const CLASS_LABELS: Record<ReboundClass, string> = {
  phoenix: 'Phoenix',
  revival: 'Revival',
  stir: 'Stir',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ratioLabel(ratio: number): string {
  if (ratio >= 100) return '100×+'
  if (ratio >= 10) return `${Math.round(ratio)}×`
  return `${ratio.toFixed(1)}×`
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function dormancyLabel(avg: number): string {
  if (avg <= 0.05) return 'essentially dormant'
  if (avg < 0.5)  return `~${(avg * 7).toFixed(0)} votes/week recently`
  return `~${avg.toFixed(1)} votes/day recently`
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function ReboundCard({ topic, index }: { topic: ReboundTopic; index: number }) {
  const cfg = CLASS_CONFIG[topic.rebound_class]
  const Icon = cfg.icon

  return (
    <motion.div
      key={topic.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'block rounded-2xl border p-4 transition-all',
          'bg-surface-100 hover:bg-surface-200',
          cfg.border,
          'hover:border-opacity-60'
        )}
      >
        <div className="flex items-start gap-3">
          {/* Class icon */}
          <div
            className={cn(
              'flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl',
              cfg.bg,
              'border',
              cfg.border
            )}
          >
            <Icon className={cn('h-4 w-4', cfg.color)} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-white leading-snug line-clamp-2">
                {topic.statement}
              </p>
              {/* Ratio badge */}
              <span
                className={cn(
                  'flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg',
                  'text-[11px] font-mono font-bold border',
                  cfg.badgeClass
                )}
              >
                <TrendingUp className="h-3 w-3" />
                {ratioLabel(topic.rebound_ratio)}
              </span>
            </div>

            {/* Rebound bar: shows dormant baseline vs recent burst */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-surface-500 w-16 shrink-0">
                  Dormant avg
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
                  <div
                    className="h-full bg-surface-500 rounded-full"
                    style={{
                      width: `${Math.min(
                        (topic.dormant_daily_avg / Math.max(topic.recent_votes, 1)) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-surface-500 w-14 text-right shrink-0">
                  {dormancyLabel(topic.dormant_daily_avg)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-white/80 w-16 shrink-0">
                  Last 24h
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
                  <motion.div
                    className={cn('h-full rounded-full', cfg.bg.replace('/10', '/80'))}
                    style={{ background: undefined }}
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 0.7, ease: 'easeOut', delay: index * 0.04 }}
                  >
                    {/* solid fill via className */}
                    <div
                      className={cn('h-full w-full rounded-full', {
                        'bg-gold': topic.rebound_class === 'phoenix',
                        'bg-emerald': topic.rebound_class === 'revival',
                        'bg-purple': topic.rebound_class === 'stir',
                      })}
                    />
                  </motion.div>
                </div>
                <span className={cn('text-[10px] font-mono w-14 text-right shrink-0', cfg.color)}>
                  {topic.recent_votes.toLocaleString()} votes
                </span>
              </div>
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-2 flex-wrap">
              {topic.category && (
                <span className="text-[11px] font-mono text-surface-500">
                  {topic.category}
                </span>
              )}
              <span className="text-[11px] font-mono text-surface-600">·</span>
              <span className="text-[11px] font-mono text-surface-500">
                {topic.total_votes.toLocaleString()} total votes
              </span>
              <span className="text-[11px] font-mono text-surface-600">·</span>
              <span className="text-[11px] font-mono text-surface-500">
                quiet ~{topic.days_since_peak}d
              </span>
              <span className="text-[11px] font-mono text-surface-600">·</span>
              <span className="text-[11px] font-mono text-surface-500">
                {relativeTime(topic.created_at)}
              </span>
              <Badge
                variant={
                  topic.status === 'law'
                    ? 'law'
                    : topic.status === 'voting'
                    ? 'active'
                    : topic.status === 'active'
                    ? 'active'
                    : topic.status === 'failed'
                    ? 'failed'
                    : 'proposed'
                }
                className="text-[10px]"
              >
                {topic.status.toUpperCase()}
              </Badge>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Category breakdown ───────────────────────────────────────────────────────

function CategoryBreakdown({ cats }: { cats: CategoryRebound[] }) {
  if (cats.length === 0) return null

  const maxRatio = Math.max(...cats.map((c) => c.avg_rebound_ratio), 1)

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart2 className="h-4 w-4 text-surface-500" />
        <h3 className="text-sm font-mono font-semibold text-white">By Category</h3>
        <span className="text-xs text-surface-500 font-mono">avg rebound ratio</span>
      </div>
      <div className="space-y-2">
        {cats.slice(0, 8).map((cat) => {
          const pct = cat.avg_rebound_ratio / maxRatio
          const CatIcon = CAT_ICON[cat.category] ?? Activity
          return (
            <div key={cat.category} className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 w-24 shrink-0">
                <CatIcon className="h-3 w-3 text-surface-500 shrink-0" />
                <span className="text-[11px] font-mono text-surface-400 truncate">
                  {cat.category}
                </span>
              </div>
              <div className="flex-1 flex items-center gap-1">
                <div className="flex-1 h-2 rounded-full bg-surface-300 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gold"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct * 100}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
                <span className="text-[10px] font-mono text-gold w-10 text-right shrink-0">
                  {ratioLabel(cat.avg_rebound_ratio)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {cat.phoenix_count > 0 && (
                  <span className="text-[9px] font-mono text-gold bg-gold/10 border border-gold/20 rounded px-1">
                    {cat.phoenix_count}🔥
                  </span>
                )}
                <span className="text-[10px] text-surface-500 font-mono">
                  {cat.topic_count}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Stats strip ──────────────────────────────────────────────────────────────

function StatsStrip({ data }: { data: ReboundResponse }) {
  const { stats } = data
  const signalColor =
    stats.platform_rebound_signal === 'hot'
      ? 'text-gold'
      : stats.platform_rebound_signal === 'warm'
      ? 'text-emerald'
      : 'text-surface-500'
  const signalLabel =
    stats.platform_rebound_signal === 'hot'
      ? 'Platform is heating up'
      : stats.platform_rebound_signal === 'warm'
      ? 'Some topics stirring'
      : 'Mostly quiet'

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        {
          label: 'Total Rebounding',
          value: stats.total_rebounding.toString(),
          sub: 'topics awoken from dormancy',
          color: 'text-white',
        },
        {
          label: 'Phoenix Topics',
          value: stats.phoenix_count.toString(),
          sub: '5× or more their quiet baseline',
          color: 'text-gold',
        },
        {
          label: 'Avg Rebound',
          value: ratioLabel(stats.avg_rebound_ratio),
          sub: 'mean rebound ratio across all',
          color: 'text-emerald',
        },
        {
          label: 'Platform Signal',
          value: stats.platform_rebound_signal.charAt(0).toUpperCase() + stats.platform_rebound_signal.slice(1),
          sub: signalLabel,
          color: signalColor,
        },
      ].map((s) => (
        <div
          key={s.label}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-4"
        >
          <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-1">
            {s.label}
          </p>
          <p className={cn('text-xl font-mono font-bold leading-none mb-1', s.color)}>
            {s.value}
          </p>
          <p className="text-[10px] text-surface-600 font-mono leading-tight">{s.sub}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Tab pills ────────────────────────────────────────────────────────────────

function TabPill({
  cls,
  count,
  active,
  onClick,
}: {
  cls: ReboundClass
  count: number
  active: boolean
  onClick: () => void
}) {
  const cfg = CLASS_CONFIG[cls]
  const Icon = cfg.icon
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-all',
        active
          ? cn(cfg.bg, cfg.border, cfg.color)
          : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white'
      )}
    >
      <Icon className="h-3 w-3" />
      {CLASS_LABELS[cls]}
      {count > 0 && (
        <span
          className={cn(
            'ml-0.5 flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold',
            active ? 'bg-white/20 text-white' : 'bg-surface-300 text-surface-500'
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorks({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-surface-500 shrink-0" />
          <span className="text-sm font-mono font-semibold text-white">
            How Rebound Works
          </span>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-surface-500 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 text-sm text-surface-500 font-mono border-t border-surface-300 pt-3">
              <p>
                <span className="text-white font-semibold">Rebound</span> measures
                how much a topic&apos;s recent 24-hour activity exceeds its dormancy
                baseline — the average daily votes it received during days 8–30 ago.
              </p>
              <p>
                <strong className="text-white">Rebound Ratio</strong> ={' '}
                <em>recent 24h votes ÷ dormant daily avg</em>
              </p>
              <p>
                A ratio of 10× means the topic got as many votes in the last
                day as it normally got in 10 days during its quiet period.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {CLASS_ORDER.map((c) => {
                  const cfg = CLASS_CONFIG[c]
                  const Icon = cfg.icon
                  return (
                    <div
                      key={c}
                      className={cn('rounded-lg p-2.5 border text-xs', cfg.bg, cfg.border)}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <Icon className={cn('h-3 w-3', cfg.color)} />
                        <span className={cn('font-bold', cfg.color)}>{cfg.label}</span>
                        <span className="text-surface-600 text-[10px] ml-auto">
                          {cfg.ratioLabel}
                        </span>
                      </div>
                      <p className="text-surface-500 leading-tight">{cfg.desc}</p>
                    </div>
                  )
                })}
              </div>
              <p className="text-surface-600 text-xs leading-relaxed">
                Requires ≥2 recent votes and ≥5 total votes. The dormancy window
                (days 8–30) excludes the last week to avoid confounding steady
                engagement with a true rebound.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReboundClient() {
  const [data, setData] = useState<ReboundResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeClass, setActiveClass] = useState<ReboundClass>('phoenix')
  const [infoOpen, setInfoOpen] = useState(false)
  const [showCats, setShowCats] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/rebound', { signal: ctrl.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: ReboundResponse = await res.json()
      setData(json)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError('Failed to load rebound data')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    return () => abortRef.current?.abort()
  }, [load])

  // Auto-switch to first non-empty tab
  useEffect(() => {
    if (!data) return
    const tabData: Record<ReboundClass, ReboundTopic[]> = {
      phoenix: data.phoenix,
      revival: data.revival,
      stir: data.stir,
    }
    if (tabData[activeClass].length === 0) {
      const first = CLASS_ORDER.find((c) => tabData[c].length > 0)
      if (first) setActiveClass(first)
    }
  }, [data, activeClass])

  const tabData = data
    ? { phoenix: data.phoenix, revival: data.revival, stir: data.stir }
    : null

  const currentTopics = tabData ? tabData[activeClass] : []
  const cfg = CLASS_CONFIG[activeClass]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-6">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
              <Flame className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Civic Rebound
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Topics that went dormant and are coming back to life
              </p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh rebound data"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono',
              'bg-surface-200 border-surface-300 text-surface-500',
              'hover:border-surface-400 hover:text-white transition-colors',
              'disabled:opacity-50'
            )}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </button>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="rounded-xl bg-against-500/10 border border-against-500/30 p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-against-400 shrink-0" />
            <p className="text-sm text-against-300 font-mono">{error}</p>
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {loading && !data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-24 rounded-full" />
              ))}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        )}

        {/* ── Data ── */}
        {data && !loading && (
          <>
            {/* Stats strip */}
            <StatsStrip data={data} />

            {/* How it works */}
            <HowItWorks
              open={infoOpen}
              onToggle={() => setInfoOpen((v) => !v)}
            />

            {/* Tabs */}
            <div className="flex items-center gap-2 flex-wrap">
              {CLASS_ORDER.map((c) => (
                <TabPill
                  key={c}
                  cls={c}
                  count={tabData![c].length}
                  active={activeClass === c}
                  onClick={() => setActiveClass(c)}
                />
              ))}
            </div>

            {/* Tab description */}
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-mono',
                cfg.bg,
                cfg.border,
                cfg.color
              )}
            >
              <Zap className="h-3.5 w-3.5 flex-shrink-0" />
              {cfg.desc}
            </div>

            {/* Topic list */}
            {currentTopics.length === 0 ? (
              <EmptyState
                icon={Flame}
                title={`No ${CLASS_LABELS[activeClass]} Topics`}
                description="No topics qualify for this rebound class right now. Check back soon."
              />
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeClass}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-3"
                >
                  {currentTopics.map((topic, i) => (
                    <ReboundCard key={topic.id} topic={topic} index={i} />
                  ))}
                </motion.div>
              </AnimatePresence>
            )}

            {/* Category breakdown toggle */}
            <button
              onClick={() => setShowCats((v) => !v)}
              className={cn(
                'w-full flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors',
                'bg-surface-100 border-surface-300 hover:border-surface-400 text-sm font-mono'
              )}
            >
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-surface-500" />
                <span className="text-white">Category Breakdown</span>
              </div>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-surface-500 transition-transform',
                  showCats && 'rotate-180'
                )}
              />
            </button>
            <AnimatePresence>
              {showCats && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <CategoryBreakdown cats={data.category_breakdown} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Related pages */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
              <p className="text-xs font-mono text-surface-500 mb-3 uppercase tracking-wider">
                Related Analysis
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { href: '/tremor', label: 'Tremor', desc: 'Recent opinion shifts' },
                  { href: '/momentum', label: 'Momentum', desc: 'Raw vote velocity' },
                  { href: '/surge', label: 'Surge', desc: 'Threshold proximity' },
                  { href: '/seismic', label: 'Seismic', desc: 'Activity spikes' },
                  { href: '/graveyard', label: 'Graveyard', desc: 'Failed topics' },
                  { href: '/inflection', label: 'Inflection', desc: 'Turning points' },
                ].map((p) => (
                  <Link
                    key={p.href}
                    href={p.href}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 hover:bg-surface-300 transition-all group"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-mono font-semibold text-white group-hover:text-gold transition-colors">
                        {p.label}
                      </p>
                      <p className="text-[10px] font-mono text-surface-500">{p.desc}</p>
                    </div>
                    <ArrowRight className="h-3 w-3 text-surface-600 flex-shrink-0 ml-auto group-hover:text-gold transition-colors" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Footer */}
            <p className="text-center text-[11px] font-mono text-surface-600">
              Snapshot at{' '}
              {new Date(data.generated_at).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              · compares last 24h vs days 8–30 ago · refreshes every 5 min
            </p>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
