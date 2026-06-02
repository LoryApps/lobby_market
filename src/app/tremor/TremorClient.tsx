'use client'

/**
 * /tremor — The Opinion Seismograph
 *
 * Detects where RECENT voter behaviour deviates from a topic's
 * all-time consensus — surfacing emerging reversals and reinforcements
 * before the overall stats have caught up.
 *
 * Tremor pp = recent_blue_pct − all_time_blue_pct
 *
 * Types:
 *   Surge     (+15pp or more) — recent voters flood to FOR despite lower historical average
 *   Reversal  (-15pp or less) — recent voters swing AGAINST after historical FOR majority
 *   Deepening (+5 to +14pp)   — moderate FOR reinforcement
 *   Erosion   (-5 to -14pp)   — moderate AGAINST pressure eroding existing majority
 *
 * Distinct from:
 *   /seismic    — activity spikes (volume anomalies, not direction shifts)
 *   /momentum   — vote velocity over time (how fast, not how far off-baseline)
 *   /turbulence — variance / instability in vote split
 *   /schism     — deadlock / near-50/50 polarisation
 *   /amplitude  — absolute magnitude of consensus (not change from baseline)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowDownRight,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BarChart2,
  ChevronDown,
  Cpu,
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
  TrendingDown,
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
  TremorResponse,
  TremorTopic,
  TremorType,
  CategoryTremor,
} from '@/app/api/tremor/route'

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

// ─── Tremor type config ───────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  TremorType,
  {
    label: string
    icon: typeof TrendingUp
    color: string
    bg: string
    border: string
    desc: string
    arrowClass: string
  }
> = {
  surge: {
    label: 'Surge',
    icon: TrendingUp,
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    desc: 'Recent voters flooding FOR — well above historical average',
    arrowClass: 'text-for-400',
  },
  reversal: {
    label: 'Reversal',
    icon: TrendingDown,
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    desc: 'Recent voters swinging AGAINST — eroding historical FOR lead',
    arrowClass: 'text-against-400',
  },
  deepening: {
    label: 'Deepening',
    icon: ArrowUpRight,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    desc: 'Moderate FOR reinforcement — consensus strengthening',
    arrowClass: 'text-emerald',
  },
  erosion: {
    label: 'Erosion',
    icon: ArrowDownRight,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    desc: 'Moderate AGAINST pressure — majority being tested',
    arrowClass: 'text-gold',
  },
}

const TAB_ORDER: TremorType[] = ['surge', 'reversal', 'deepening', 'erosion']
const TAB_LABELS: Record<TremorType, string> = {
  surge: 'Surges',
  reversal: 'Reversals',
  deepening: 'Deepening',
  erosion: 'Erosion',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ppLabel(pp: number): string {
  const abs = Math.abs(pp)
  const sign = pp >= 0 ? '+' : '−'
  return `${sign}${abs.toFixed(1)}pp`
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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── VoteBar mini ─────────────────────────────────────────────────────────────

function MiniVoteBar({
  overall,
  recent,
  className,
}: {
  overall: number
  recent: number
  className?: string
}) {
  return (
    <div className={cn('space-y-1', className)}>
      {/* Historical */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-surface-500 w-14 shrink-0">Historical</span>
        <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
          <div
            className="h-full bg-for-500/60 rounded-full transition-all"
            style={{ width: `${overall}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-surface-500 w-8 text-right shrink-0">
          {Math.round(overall)}%
        </span>
      </div>
      {/* Recent */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-white/80 w-14 shrink-0">Recent 24h</span>
        <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${recent}%`,
              background: recent > overall ? '#60a5fa' : '#f87171',
            }}
          />
        </div>
        <span
          className={cn(
            'text-[10px] font-mono w-8 text-right shrink-0',
            recent > overall ? 'text-for-400' : 'text-against-400'
          )}
        >
          {Math.round(recent)}%
        </span>
      </div>
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function TremorCard({ topic, index }: { topic: TremorTopic; index: number }) {
  const cfg = TYPE_CONFIG[topic.tremor_type]
  const Icon = cfg.icon
  const DeviationArrow = topic.tremor_pp > 0 ? ArrowUp : ArrowDown

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
          {/* Rank / icon */}
          <div
            className={cn(
              'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg',
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
              {/* Tremor badge */}
              <span
                className={cn(
                  'flex-shrink-0 flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold',
                  cfg.bg,
                  'border',
                  cfg.border,
                  cfg.color
                )}
              >
                <DeviationArrow className={cn('h-3 w-3', cfg.arrowClass)} />
                {ppLabel(topic.tremor_pp)}
              </span>
            </div>

            {/* Vote bars */}
            <MiniVoteBar
              overall={topic.overall_blue_pct}
              recent={topic.recent_blue_pct}
            />

            {/* Meta row */}
            <div className="flex items-center gap-2 flex-wrap">
              {topic.category && (
                <span className="text-[11px] font-mono text-surface-500">
                  {topic.category}
                </span>
              )}
              <span className="text-[11px] font-mono text-surface-600">·</span>
              <span className="text-[11px] font-mono text-surface-500">
                {topic.recent_votes.toLocaleString()} recent votes
              </span>
              <span className="text-[11px] font-mono text-surface-600">·</span>
              <span className="text-[11px] font-mono text-surface-500">
                {topic.total_votes.toLocaleString()} total
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

// ─── Category bar chart ───────────────────────────────────────────────────────

function CategoryBreakdown({ cats }: { cats: CategoryTremor[] }) {
  if (cats.length === 0) return null

  const maxAbs = Math.max(...cats.map((c) => Math.abs(c.avg_tremor_pp)), 1)

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart2 className="h-4 w-4 text-surface-500" />
        <h3 className="text-sm font-mono font-semibold text-white">By Category</h3>
        <span className="text-xs text-surface-500 font-mono">avg deviation</span>
      </div>
      <div className="space-y-2">
        {cats.slice(0, 8).map((cat) => {
          const isPos = cat.avg_tremor_pp >= 0
          const pct = Math.abs(cat.avg_tremor_pp) / maxAbs
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
                    className={cn(
                      'h-full rounded-full',
                      isPos ? 'bg-for-500' : 'bg-against-500'
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct * 100}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
                <span
                  className={cn(
                    'text-[10px] font-mono w-12 text-right shrink-0',
                    isPos ? 'text-for-400' : 'text-against-400'
                  )}
                >
                  {ppLabel(cat.avg_tremor_pp)}
                </span>
              </div>
              <span className="text-[10px] text-surface-500 font-mono w-6 text-right shrink-0">
                {cat.topic_count}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Stats strip ─────────────────────────────────────────────────────────────

function StatsStrip({ data }: { data: TremorResponse }) {
  const { stats } = data
  const netIsPos = stats.net_platform_shift >= 0

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        {
          label: 'Active Tremors',
          value: stats.total_active.toString(),
          sub: 'topics with 5pp+ deviation',
          color: 'text-white',
        },
        {
          label: 'Avg Deviation',
          value: `${stats.avg_tremor_abs.toFixed(1)}pp`,
          sub: 'mean abs shift from baseline',
          color: 'text-purple',
        },
        {
          label: 'Net Platform Shift',
          value: ppLabel(stats.net_platform_shift),
          sub: netIsPos ? 'net recent FOR pressure' : 'net recent AGAINST pressure',
          color: netIsPos ? 'text-for-400' : 'text-against-400',
        },
        {
          label: 'Most Volatile',
          value: stats.most_volatile_category ?? '—',
          sub: 'category with highest avg tremor',
          color: 'text-gold',
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
  type,
  count,
  active,
  onClick,
}: {
  type: TremorType
  count: number
  active: boolean
  onClick: () => void
}) {
  const cfg = TYPE_CONFIG[type]
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
      {TAB_LABELS[type]}
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

// ─── Info panel ───────────────────────────────────────────────────────────────

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
            How Tremor Works
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
                <span className="text-white font-semibold">Tremor</span> measures
                how much recent voters (last 24h) deviate from a topic&apos;s
                all-time consensus — revealing opinion shifts before they fully
                register in the overall stats.
              </p>
              <p>
                <strong className="text-white">Tremor pp</strong> ={' '}
                <em>recent FOR% − all-time FOR%</em>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {TAB_ORDER.map((t) => {
                  const c = TYPE_CONFIG[t]
                  const Icon = c.icon
                  return (
                    <div
                      key={t}
                      className={cn(
                        'rounded-lg p-2 border text-xs',
                        c.bg,
                        c.border
                      )}
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <Icon className={cn('h-3 w-3', c.color)} />
                        <span className={cn('font-bold', c.color)}>
                          {c.label}
                        </span>
                      </div>
                      <p className="text-surface-500 leading-tight">{c.desc}</p>
                    </div>
                  )
                })}
              </div>
              <p className="text-surface-600 text-xs leading-relaxed">
                Only topics with ≥3 recent votes and ≥10 total votes qualify.
                Deviations under 5pp are filtered as noise.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TremorClient() {
  const [data, setData] = useState<TremorResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TremorType>('surge')
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
      const res = await fetch('/api/tremor', { signal: ctrl.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: TremorResponse = await res.json()
      setData(json)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError('Failed to load tremor data')
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
    const tabData: Record<TremorType, TremorTopic[]> = {
      surge: data.surges,
      reversal: data.reversals,
      deepening: data.deepening,
      erosion: data.erosion,
    }
    const first = TAB_ORDER.find((t) => tabData[t].length > 0)
    if (first && tabData[activeTab].length === 0) setActiveTab(first)
  }, [data, activeTab])

  const tabData = data
    ? ({
        surge: data.surges,
        reversal: data.reversals,
        deepening: data.deepening,
        erosion: data.erosion,
      } as Record<TremorType, TremorTopic[]>)
    : null

  const currentTopics = tabData ? tabData[activeTab] : []
  const cfg = TYPE_CONFIG[activeTab]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-6">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
              <Activity className="h-5 w-5 text-against-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Civic Tremor
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Where recent opinion deviates from historical consensus
              </p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh tremor data"
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
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-24 rounded-full" />
              ))}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
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
              {TAB_ORDER.map((t) => (
                <TabPill
                  key={t}
                  type={t}
                  count={tabData![t].length}
                  active={activeTab === t}
                  onClick={() => setActiveTab(t)}
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
                icon={Activity}
                title={`No ${TAB_LABELS[activeTab]} Detected`}
                description="No topics qualify for this tremor type right now. Check back soon as votes come in."
              />
            ) : (
              <div className="space-y-3">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-3"
                  >
                    {currentTopics.map((topic, i) => (
                      <TremorCard key={topic.id} topic={topic} index={i} />
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>
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
                  { href: '/seismic', label: 'Seismic', desc: 'Activity spikes' },
                  { href: '/momentum', label: 'Momentum', desc: 'Vote velocity' },
                  { href: '/turbulence', label: 'Turbulence', desc: 'Instability index' },
                  { href: '/amplitude', label: 'Amplitude', desc: 'Consensus force' },
                  { href: '/schism', label: 'Schism', desc: 'Deepest divisions' },
                  { href: '/inflection', label: 'Inflection', desc: 'Threshold proximity' },
                ].map((p) => (
                  <Link
                    key={p.href}
                    href={p.href}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 hover:bg-surface-300 transition-all group"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-mono font-semibold text-white group-hover:text-for-300 transition-colors">
                        {p.label}
                      </p>
                      <p className="text-[10px] font-mono text-surface-500">{p.desc}</p>
                    </div>
                    <ArrowRight className="h-3 w-3 text-surface-600 flex-shrink-0 ml-auto group-hover:text-for-400 transition-colors" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Last updated */}
            <p className="text-center text-[11px] font-mono text-surface-600">
              Snapshot at{' '}
              {new Date(data.generated_at).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              · 24h window · refreshes every 5 min
            </p>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
