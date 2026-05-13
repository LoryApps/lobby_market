'use client'

/**
 * /analytics/consensus-shift — Consensus Shift Report
 *
 * Shows which individual debate topics have had the biggest swing in community
 * opinion over a chosen time window (7 / 30 / 90 days).
 *
 * "Shift" = recent FOR% minus prior-window FOR%, using only votes cast within
 * each window — not the cumulative all-time tally.  A +20 shift means the
 * recent voters are 20 pp more pro-FOR than the older cohort.
 *
 * Distinct from:
 *   /drift             — category-level average FOR% across time windows
 *   /momentum          — topics gaining raw vote volume fastest
 *   /analytics/evolution — how YOUR OWN votes have shifted over time
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BarChart2,
  ChevronRight,
  Flame,
  Minus,
  RefreshCw,
  Scale,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  ConsensusShiftResponse,
  ConsensusShiftTopic,
  CategoryShift,
  Window,
} from '@/app/api/analytics/consensus-shift/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WINDOW_OPTIONS: { value: Window; label: string; desc: string }[] = [
  { value: '7d', label: '7 days', desc: 'vs prior 7 days' },
  { value: '30d', label: '30 days', desc: 'vs prior 30 days' },
  { value: '90d', label: '90 days', desc: 'vs prior 90 days' },
]

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

function fmt(n: number | null): string {
  if (n === null) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}pp`
}

function pct(n: number | null): string {
  if (n === null) return '—'
  return `${Math.round(n)}%`
}

function shiftColor(shift: number): string {
  if (shift > 10) return 'text-for-400'
  if (shift > 5) return 'text-for-500'
  if (shift < -10) return 'text-against-400'
  if (shift < -5) return 'text-against-500'
  return 'text-surface-500'
}

function ShiftArrow({ shift }: { shift: number }) {
  if (shift > 5) return <ArrowUp className={cn('h-3.5 w-3.5 flex-shrink-0', shiftColor(shift))} />
  if (shift < -5) return <ArrowDown className={cn('h-3.5 w-3.5 flex-shrink-0', shiftColor(shift))} />
  return <Minus className="h-3.5 w-3.5 flex-shrink-0 text-surface-600" />
}

// ─── Shift bar visualisation ──────────────────────────────────────────────────

function ShiftBar({
  priorPct,
  recentPct,
}: {
  priorPct: number
  recentPct: number
}) {
  const minPct = Math.min(priorPct, recentPct)
  const maxPct = Math.max(priorPct, recentPct)
  const isSurging = recentPct >= priorPct

  return (
    <div className="relative h-2 w-full rounded-full bg-surface-300 overflow-hidden">
      {/* Full bar baseline (prior) */}
      <div
        className={cn(
          'absolute inset-y-0 left-0 rounded-full',
          isSurging ? 'bg-for-700/50' : 'bg-against-700/50'
        )}
        style={{ width: `${priorPct}%` }}
      />
      {/* Shift band */}
      <div
        className={cn(
          'absolute inset-y-0 rounded-full',
          isSurging ? 'bg-for-400' : 'bg-against-400'
        )}
        style={{
          left: `${minPct}%`,
          width: `${maxPct - minPct}%`,
        }}
      />
      {/* Midline */}
      <div className="absolute inset-y-0 w-px bg-surface-500/50" style={{ left: '50%' }} />
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function TopicCard({
  entry,
  index,
}: {
  entry: ConsensusShiftTopic
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors overflow-hidden"
    >
      <Link href={`/topic/${entry.id}`} className="block p-4">
        {/* Header */}
        <div className="flex items-start gap-2 mb-3">
          <ShiftArrow shift={entry.shift} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <Badge variant={STATUS_BADGE[entry.status] ?? 'proposed'}>
                {entry.status === 'voting' ? 'Voting' : entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
              </Badge>
              {entry.category && (
                <span className="text-[11px] font-mono text-surface-500">{entry.category}</span>
              )}
            </div>
            <p className="text-sm font-mono font-semibold text-white line-clamp-2 leading-snug">
              {entry.statement}
            </p>
          </div>
        </div>

        {/* Shift bar */}
        <div className="mb-2">
          <ShiftBar
            priorPct={entry.prior_blue_pct ?? 50}
            recentPct={entry.recent_blue_pct ?? 50}
          />
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between text-[11px] font-mono">
          <div className="flex items-center gap-3">
            <span className="text-surface-500">
              Prior: <span className="text-surface-300">{pct(entry.prior_blue_pct)} FOR</span>
            </span>
            <ChevronRight className="h-3 w-3 text-surface-600" />
            <span className="text-surface-500">
              Recent: <span className="text-surface-300">{pct(entry.recent_blue_pct)} FOR</span>
            </span>
          </div>
          <span className={cn('font-bold', shiftColor(entry.shift))}>
            {fmt(entry.shift)}
          </span>
        </div>

        {/* Vote counts */}
        <div className="mt-1.5 flex items-center gap-2 text-[10px] font-mono text-surface-600">
          <span>Recent: {entry.recent_total} votes</span>
          <span>·</span>
          <span>Prior: {entry.prior_total} votes</span>
          <span>·</span>
          <span>All-time: {entry.total_votes.toLocaleString()}</span>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Category volatility card ─────────────────────────────────────────────────

function CategoryCard({ cat, index }: { cat: CategoryShift; index: number }) {
  const surgeRatio = cat.topic_count > 0 ? cat.surging_count / cat.topic_count : 0
  const declineRatio = cat.topic_count > 0 ? cat.declining_count / cat.topic_count : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="rounded-xl bg-surface-100 border border-surface-300 p-3"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono font-semibold text-white">{cat.category}</span>
        <span className="text-[11px] font-mono text-surface-500">{cat.topic_count} topics</span>
      </div>

      {/* Surge/decline mini bar */}
      <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300 mb-2">
        <div
          className="bg-for-500"
          style={{ width: `${surgeRatio * 100}%` }}
        />
        <div
          className="bg-against-500"
          style={{ width: `${declineRatio * 100}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="text-for-400">{cat.surging_count} surging</span>
        <span className={cn(
          'font-semibold',
          cat.avg_shift > 2 ? 'text-for-400' : cat.avg_shift < -2 ? 'text-against-400' : 'text-surface-500'
        )}>
          avg {fmt(cat.avg_shift)}
        </span>
        <span className="text-against-400">{cat.declining_count} declining</span>
      </div>

      {/* Volatility indicator */}
      <div className="mt-1.5 text-[10px] font-mono text-surface-600">
        Volatility: {cat.volatility.toFixed(1)}pp σ
      </div>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-3.5 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ConsensusShiftPage() {
  const router = useRouter()
  const [window, setWindow] = useState<Window>('30d')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ConsensusShiftResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'surging' | 'declining' | 'categories'>('surging')

  const load = useCallback(async (w: Window) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/analytics/consensus-shift?window=${w}`)
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error(`Error ${res.status}`)
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load(window) }, [window, load])

  const handleWindow = (w: Window) => {
    setWindow(w)
    setData(null)
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back nav */}
        <Link
          href="/analytics"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Analytics
        </Link>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
              <Zap className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Consensus Shift</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Topics where community opinion is changing fastest
              </p>
            </div>
          </div>

          {!loading && (
            <button
              onClick={() => load(window)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-400 border border-surface-400/40 hover:text-white hover:border-surface-400 transition-all"
              aria-label="Refresh"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          )}
        </div>

        {/* Time window toggle */}
        <div className="mb-5 flex items-center gap-2">
          <span className="text-xs font-mono text-surface-500 mr-1">Window:</span>
          {WINDOW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleWindow(opt.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all',
                window === opt.value
                  ? 'bg-gold/20 text-gold border border-gold/40'
                  : 'bg-surface-200 text-surface-500 border border-surface-300 hover:text-white hover:border-surface-400'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Summary stats */}
        {data && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 grid grid-cols-3 gap-3"
          >
            <div className="rounded-xl bg-surface-100 border border-surface-300 px-3 py-3 text-center">
              <div className="text-lg font-mono font-bold text-for-400">{data.surging.length}</div>
              <div className="text-[11px] font-mono text-surface-500 mt-0.5">Surging FOR</div>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 px-3 py-3 text-center">
              <div className="text-lg font-mono font-bold text-surface-300">{data.total_topics_analysed}</div>
              <div className="text-[11px] font-mono text-surface-500 mt-0.5">Topics analysed</div>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 px-3 py-3 text-center">
              <div className="text-lg font-mono font-bold text-against-400">{data.declining.length}</div>
              <div className="text-[11px] font-mono text-surface-500 mt-0.5">Losing support</div>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="mb-4 flex gap-1 bg-surface-200 rounded-xl p-1">
          {([
            { id: 'surging' as const, label: 'Surging FOR', icon: ArrowUp, color: 'text-for-400' },
            { id: 'declining' as const, label: 'Losing Ground', icon: ArrowDown, color: 'text-against-400' },
            { id: 'categories' as const, label: 'By Category', icon: BarChart2, color: 'text-gold' },
          ] as const).map(({ id, label, icon: Icon, color }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-mono font-semibold transition-all',
                tab === id
                  ? 'bg-surface-100 text-white border border-surface-300'
                  : 'text-surface-500 hover:text-surface-300'
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', tab === id ? color : '')} />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading && <LoadingSkeleton />}

        {error && !loading && (
          <div className="rounded-xl bg-against-500/10 border border-against-500/30 p-6 text-center">
            <Scale className="h-8 w-8 text-against-400 mx-auto mb-3" />
            <p className="text-sm font-mono text-against-300 mb-3">{error}</p>
            <button
              onClick={() => load(window)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-xs font-mono font-semibold hover:bg-for-700 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Try again
            </button>
          </div>
        )}

        {!loading && data && (
          <AnimatePresence mode="wait">
            {/* Surging tab */}
            {tab === 'surging' && (
              <motion.div
                key="surging"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {data.surging.length === 0 ? (
                  <EmptyState
                    icon={ArrowUp}
                    title="No surging topics"
                    description={`No topics showed significant FOR momentum in the past ${window}. Try a wider window.`}
                  />
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-mono text-surface-500 mb-1 flex items-center gap-1.5">
                      <ArrowUp className="h-3 w-3 text-for-400" />
                      Gaining FOR support — recent voters are more in favour than older cohort
                    </p>
                    {data.surging.map((entry, i) => (
                      <TopicCard key={entry.id} entry={entry} index={i} />
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Declining tab */}
            {tab === 'declining' && (
              <motion.div
                key="declining"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {data.declining.length === 0 ? (
                  <EmptyState
                    icon={ArrowDown}
                    title="No declining topics"
                    description={`No topics showed significant FOR decline in the past ${window}. Try a wider window.`}
                  />
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-mono text-surface-500 mb-1 flex items-center gap-1.5">
                      <ArrowDown className="h-3 w-3 text-against-400" />
                      Losing FOR support — recent voters lean more AGAINST than the older cohort
                    </p>
                    {data.declining.map((entry, i) => (
                      <TopicCard key={entry.id} entry={entry} index={i} />
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Categories tab */}
            {tab === 'categories' && (
              <motion.div
                key="categories"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {data.category_shifts.length === 0 ? (
                  <EmptyState
                    icon={BarChart2}
                    title="No category data"
                    description="Not enough topic data to compute category-level shifts yet."
                  />
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-mono text-surface-500 mb-1 flex items-center gap-1.5">
                      <Flame className="h-3 w-3 text-gold" />
                      Sorted by volatility — categories where consensus is shifting most
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {data.category_shifts.map((cat, i) => (
                        <CategoryCard key={cat.category} cat={cat} index={i} />
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Footer links */}
        {!loading && data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8 grid grid-cols-2 gap-3"
          >
            <Link
              href="/drift"
              className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
            >
              <div>
                <p className="text-xs font-mono font-semibold text-white">Opinion Drift</p>
                <p className="text-[11px] font-mono text-surface-500">Category-level trends</p>
              </div>
              <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
            </Link>
            <Link
              href="/momentum"
              className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
            >
              <div>
                <p className="text-xs font-mono font-semibold text-white">Momentum</p>
                <p className="text-[11px] font-mono text-surface-500">Fastest-growing topics</p>
              </div>
              <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
            </Link>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
