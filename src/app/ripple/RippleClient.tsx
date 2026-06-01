'use client'

/**
 * /ripple — The Civic Ripple Effect
 *
 * When a topic reaches its verdict — passing into law or failing — the debate
 * doesn't end. Its outcome sends ripples across the civic landscape, influencing
 * the momentum of related debates in the same category.
 *
 * This page maps those connections: recently resolved topics as "anchors" and
 * the active debates whose current lean aligns (or conflicts) with that verdict.
 *
 * A high ripple score means the community is consistently moving in the same
 * ideological direction across a whole category after a key decision.
 *
 * Distinct from:
 *   /correlations   — cross-topic voter alignment (who votes the same way)
 *   /influence      — personal vote network
 *   /convergence    — topics building toward consensus
 *   /drift          — category-level vote trend over time
 *   /connections    — wiki-link graph (no outcome analysis)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  BarChart2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Cpu,
  FlaskConical,
  GraduationCap,
  Heart,
  Info,
  Landmark,
  Leaf,
  Link2,
  Music2,
  RefreshCw,
  Scale,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { RippleAnchor, RippleTarget, RippleResponse } from '@/app/api/stats/ripple/route'

// ─── Category config ─────────────────────────────────────────────────────────

const CAT_CONFIG: Record<string, { icon: typeof Landmark; color: string; dot: string }> = {
  Economics:   { icon: TrendingUp,  color: 'text-gold',        dot: 'bg-gold' },
  Politics:    { icon: Landmark,    color: 'text-for-400',     dot: 'bg-for-500' },
  Technology:  { icon: Cpu,         color: 'text-purple',      dot: 'bg-purple' },
  Science:     { icon: FlaskConical,color: 'text-emerald',     dot: 'bg-emerald' },
  Ethics:      { icon: Scale,       color: 'text-against-300', dot: 'bg-against-500' },
  Philosophy:  { icon: BookOpen,    color: 'text-for-300',     dot: 'bg-for-400' },
  Culture:     { icon: Music2,      color: 'text-gold',        dot: 'bg-gold' },
  Health:      { icon: Heart,       color: 'text-against-300', dot: 'bg-against-400' },
  Environment: { icon: Leaf,        color: 'text-emerald',     dot: 'bg-emerald' },
  Education:   { icon: GraduationCap, color: 'text-purple',   dot: 'bg-purple' },
}

const CATEGORIES = Object.keys(CAT_CONFIG)

// ─── Window options ──────────────────────────────────────────────────────────

const WINDOW_OPTIONS = [
  { value: 30,  label: '30d' },
  { value: 60,  label: '60d' },
  { value: 90,  label: '90d' },
  { value: 180, label: '180d' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  const w = Math.floor(d / 7)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  if (w < 8) return `${w}w ago`
  return `${Math.floor(d / 30)}mo ago`
}

// ─── Ripple score ring ────────────────────────────────────────────────────────

function RippleRing({ score, verdict }: { score: number; verdict: 'law' | 'failed' }) {
  const size = 52
  const stroke = 4
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ

  const ringColor =
    verdict === 'law'
      ? score >= 70 ? '#10b981' : score >= 40 ? '#3b82f6' : '#6b7280'
      : score >= 70 ? '#ef4444' : score >= 40 ? '#f97316' : '#6b7280'

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="#1e2433" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-mono font-bold text-white">{score}%</span>
      </div>
    </div>
  )
}

// ─── Target card ──────────────────────────────────────────────────────────────

function TargetCard({
  target,
  verdict,
}: {
  target: RippleTarget
  verdict: 'law' | 'failed'
}) {
  const forPct = Math.round(target.blue_pct)
  const againstPct = 100 - forPct

  const alignClass =
    target.alignment === 'aligned'
      ? verdict === 'law'
        ? 'border-emerald/30 bg-emerald/5'
        : 'border-against-500/30 bg-against-500/5'
      : target.alignment === 'opposed'
        ? verdict === 'law'
          ? 'border-against-500/20 bg-against-500/5'
          : 'border-emerald/20 bg-emerald/5'
        : 'border-surface-300/60 bg-surface-200/40'

  const alignLabel =
    target.alignment === 'aligned'
      ? verdict === 'law' ? 'With the wave' : 'Riding the opposition'
      : target.alignment === 'opposed'
        ? verdict === 'law' ? 'Swimming upstream' : 'Breaking the trend'
        : 'Contested'

  const alignColor =
    target.alignment === 'aligned'
      ? verdict === 'law' ? 'text-emerald' : 'text-against-300'
      : target.alignment === 'opposed'
        ? verdict === 'law' ? 'text-against-300' : 'text-emerald'
        : 'text-surface-500'

  const statusConfig: Record<string, { label: string; color: string }> = {
    proposed: { label: 'Proposed', color: 'text-surface-400' },
    active:   { label: 'Active',   color: 'text-emerald' },
    voting:   { label: 'Voting',   color: 'text-purple' },
  }
  const status = statusConfig[target.status] ?? { label: target.status, color: 'text-surface-400' }

  return (
    <Link href={`/topic/${target.id}`} className="block group">
      <div
        className={cn(
          'rounded-xl border p-3 transition-all duration-200',
          'hover:border-surface-400/80 hover:bg-surface-200/60',
          alignClass
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {target.link_type === 'wiki' && (
              <Link2 className="h-3 w-3 text-purple flex-shrink-0" />
            )}
            <span className={cn('text-[10px] font-mono', status.color)}>
              {status.label}
            </span>
          </div>
          <span className={cn('text-[10px] font-mono font-semibold', alignColor)}>
            {alignLabel}
          </span>
        </div>

        {/* Statement */}
        <p className="text-xs text-surface-700 group-hover:text-white transition-colors leading-snug mb-2.5 line-clamp-2">
          {target.statement}
        </p>

        {/* Vote bar */}
        <div className="space-y-1">
          <div className="flex overflow-hidden rounded-full h-1.5 bg-surface-300">
            <div
              className="bg-for-500 transition-all duration-500"
              style={{ width: `${forPct}%` }}
            />
            <div className="flex-1 bg-against-500" />
          </div>
          <div className="flex justify-between text-[9px] font-mono text-surface-500">
            <span className="text-for-400">{forPct}% FOR</span>
            <span className="text-against-400">{againstPct}% AGAINST</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Anchor card ─────────────────────────────────────────────────────────────

function AnchorCard({ anchor }: { anchor: RippleAnchor }) {
  const [expanded, setExpanded] = useState(false)
  const cat = anchor.category ? CAT_CONFIG[anchor.category] : null
  const CatIcon = cat?.icon ?? Activity
  const forPct = Math.round(anchor.blue_pct)

  const verdictColor = anchor.verdict === 'law' ? 'text-gold' : 'text-surface-500'
  const verdictBg   = anchor.verdict === 'law' ? 'bg-gold/10 border-gold/30' : 'bg-surface-300/20 border-surface-400/30'
  const verdictLabel = anchor.verdict === 'law' ? 'Law' : 'Failed'

  const displayTargets = expanded ? anchor.ripple_targets : anchor.ripple_targets.slice(0, 3)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
    >
      {/* Anchor header */}
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Meta row */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={cn('text-[10px] font-mono px-2 py-0.5 rounded-full border', verdictBg, verdictColor)}>
                {verdictLabel}
              </span>
              {anchor.category && (
                <span className={cn('text-[10px] font-mono', cat?.color ?? 'text-surface-400')}>
                  <CatIcon className="inline h-3 w-3 mr-0.5" />
                  {anchor.category}
                </span>
              )}
              <span className="text-[10px] font-mono text-surface-500">
                {relativeTime(anchor.resolved_at)}
              </span>
            </div>

            {/* Statement */}
            <Link href={`/topic/${anchor.id}`} className="group">
              <h3 className="text-sm font-semibold text-white group-hover:text-for-300 transition-colors leading-snug line-clamp-2">
                {anchor.statement}
              </h3>
            </Link>

            {/* Vote result */}
            <div className="flex items-center gap-3 mt-2">
              <div className="flex overflow-hidden rounded-full h-1 flex-1 bg-surface-300">
                <div className="bg-for-500 transition-all duration-500" style={{ width: `${forPct}%` }} />
                <div className="flex-1 bg-against-500" />
              </div>
              <span className="text-[10px] font-mono text-surface-400 flex-shrink-0">
                {forPct}% FOR · {anchor.total_votes.toLocaleString()} votes
              </span>
            </div>
          </div>

          {/* Ripple ring */}
          <RippleRing score={anchor.ripple_score} verdict={anchor.verdict} />
        </div>

        {/* Stats row */}
        {anchor.total_connected > 0 && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-surface-300/60">
            <span className="text-[10px] font-mono text-surface-500">
              {anchor.total_connected} related debate{anchor.total_connected !== 1 ? 's' : ''}
            </span>
            {anchor.aligned_count > 0 && (
              <span className={cn(
                'text-[10px] font-mono',
                anchor.verdict === 'law' ? 'text-emerald' : 'text-against-300'
              )}>
                {anchor.aligned_count} aligned
              </span>
            )}
            {anchor.opposed_count > 0 && (
              <span className="text-[10px] font-mono text-surface-500">
                {anchor.opposed_count} opposed
              </span>
            )}
          </div>
        )}
      </div>

      {/* Ripple targets */}
      {anchor.ripple_targets.length > 0 ? (
        <div className="px-4 pb-4">
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-3">
            Ripple Effect — Active Related Debates
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {displayTargets.map((target) => (
              <TargetCard key={target.id} target={target} verdict={anchor.verdict} />
            ))}
          </div>

          {anchor.ripple_targets.length > 3 && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="mt-3 flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
            >
              {expanded ? (
                <><ChevronUp className="h-3 w-3" /> Show less</>
              ) : (
                <><ChevronDown className="h-3 w-3" /> {anchor.ripple_targets.length - 3} more debates</>
              )}
            </button>
          )}
        </div>
      ) : (
        <div className="px-5 pb-4">
          <p className="text-[11px] font-mono text-surface-500">
            No active related debates found in this window.
          </p>
        </div>
      )}
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RippleClient() {
  const [data, setData] = useState<RippleResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [timeWindow, setTimeWindow] = useState(90)
  const [showInfo, setShowInfo] = useState(false)
  const fetchRef = useRef(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const id = ++fetchRef.current

    const params = new URLSearchParams({ window: String(timeWindow) })
    if (category) params.set('category', category)

    try {
      const res = await fetch(`/api/stats/ripple?${params.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: RippleResponse = await res.json()
      if (fetchRef.current !== id) return
      setData(json)
    } catch {
      if (fetchRef.current !== id) return
      setError('Failed to load ripple data')
    } finally {
      if (fetchRef.current === id) setLoading(false)
    }
  }, [category, timeWindow])

  useEffect(() => { fetchData() }, [fetchData])

  const anchors = data?.anchors ?? []

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 pt-20 pb-24">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="pt-4 pb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3 w-3" /> Home
          </Link>

          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                The Civic Ripple Effect
              </h1>
              <p className="text-sm text-surface-500 max-w-xl">
                How resolved topics send momentum across the civic landscape.
                Each verdict — law passed or motion failed — leaves ripples
                in connected debates.
              </p>
            </div>
            <button
              onClick={() => setShowInfo((s) => !s)}
              className="flex-shrink-0 p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
              aria-label="About this page"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>

          {/* Info panel */}
          <AnimatePresence>
            {showInfo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 p-4 rounded-xl bg-surface-100 border border-surface-300 text-xs text-surface-400 space-y-2">
                  <p>
                    <span className="text-white font-semibold">How it works:</span>{' '}
                    Each &ldquo;anchor&rdquo; topic resolved in the selected time window. The{' '}
                    <span className="text-white">ripple score</span> measures how many active
                    related debates (same category or wiki-linked) are currently leaning in the
                    same direction as the verdict.
                  </p>
                  <p>
                    A law that passed FOR shows a strong ripple if related debates are also
                    leaning FOR. A failed motion shows ripple if similar debates are also
                    trending AGAINST.
                  </p>
                  <p>
                    <span className="text-emerald font-mono">With the wave</span> — debate aligns with the verdict direction. {' '}
                    <span className="text-against-300 font-mono">Swimming upstream</span> — debate moves opposite to the verdict.
                  </p>
                  <div className="flex items-center gap-1 pt-1">
                    <Link2 className="h-3 w-3 text-purple" />
                    <span className="text-purple">Wiki-linked</span>
                    <span className="ml-2">= explicitly linked in topic descriptions; others share the same category.</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Stats bar ──────────────────────────────────────────────────── */}
        {data && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-3 gap-3 mb-6"
          >
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                Resolved Topics
              </p>
              <p className="text-2xl font-bold text-white">
                <AnimatedNumber value={data.total_resolved_90d} />
              </p>
              <p className="text-[10px] font-mono text-surface-500 mt-0.5">
                in last {timeWindow} days
              </p>
            </div>
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                Ripple Index
              </p>
              <p className={cn('text-2xl font-bold', data.global_ripple_index >= 60 ? 'text-emerald' : data.global_ripple_index >= 40 ? 'text-gold' : 'text-surface-400')}>
                <AnimatedNumber value={data.global_ripple_index} />%
              </p>
              <p className="text-[10px] font-mono text-surface-500 mt-0.5">
                platform-wide alignment
              </p>
            </div>
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                Laws Passed
              </p>
              <p className="text-2xl font-bold text-gold">
                <AnimatedNumber value={anchors.filter((a) => a.verdict === 'law').length} />
              </p>
              <p className="text-[10px] font-mono text-surface-500 mt-0.5">
                of {anchors.length} shown
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Controls ───────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {/* Window selector */}
          <div className="flex items-center gap-1 bg-surface-100 border border-surface-300 rounded-xl p-1">
            {WINDOW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTimeWindow(opt.value)}
                className={cn(
                  'px-3 py-1 rounded-lg text-[11px] font-mono transition-colors',
                  timeWindow === opt.value
                    ? 'bg-surface-300 text-white'
                    : 'text-surface-500 hover:text-white'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setCategory(null)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-[11px] font-mono border transition-colors',
                category === null
                  ? 'bg-surface-300 text-white border-surface-400'
                  : 'bg-surface-100 text-surface-500 border-surface-300 hover:text-white'
              )}
            >
              All
            </button>
            {CATEGORIES.map((cat) => {
              const config = CAT_CONFIG[cat]
              const CatIcon = config.icon
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat === category ? null : cat)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-mono border transition-colors',
                    category === cat
                      ? `bg-surface-300 text-white border-surface-400 ${config.color}`
                      : 'bg-surface-100 text-surface-500 border-surface-300 hover:text-white'
                  )}
                >
                  <CatIcon className="h-3 w-3" />
                  {cat}
                </button>
              )
            })}
          </div>

          {/* Refresh */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-surface-300 text-[11px] font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-3/4" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-xl flex-shrink-0" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((j) => (
                    <Skeleton key={j} className="h-20 rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-6 text-center">
            <XCircle className="h-8 w-8 text-against-400 mx-auto mb-2" />
            <p className="text-sm text-against-300">{error}</p>
            <button
              onClick={fetchData}
              className="mt-3 text-xs font-mono text-surface-400 hover:text-white transition-colors"
            >
              Try again
            </button>
          </div>
        ) : anchors.length === 0 ? (
          <EmptyState
            icon={Activity}
            iconColor="text-surface-500"
            title="No ripples yet"
            description={`No topics were resolved in the last ${window} days${category ? ` in ${category}` : ''}. Try a wider time window.`}
            actions={[{ label: 'Browse topics', href: '/topics' }]}
          />
        ) : (
          <div className="space-y-4">
            {anchors.map((anchor) => (
              <AnchorCard key={anchor.id} anchor={anchor} />
            ))}

            {/* Footer note */}
            <div className="pt-4 pb-2 flex items-center gap-2 text-[11px] font-mono text-surface-600">
              <BarChart2 className="h-3 w-3" />
              Showing {anchors.length} anchor topic{anchors.length !== 1 ? 's' : ''} resolved in the
              last {timeWindow} days.
              Ripple alignment = % of related active debates leaning in the same direction as the verdict.
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
