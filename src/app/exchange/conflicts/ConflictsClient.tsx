'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronDown,
  ChevronRight,
  GitFork,
  Info,
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
import type { ConflictPair, ConflictsResponse } from '@/app/api/exchange/conflicts/route'

// ─── Category colours ─────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-for-300',
  Philosophy:  'text-surface-400',
  Culture:     'text-against-300',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-400',
}

function catColor(cat: string | null): string {
  return cat ? (CAT_COLORS[cat] ?? 'text-surface-500') : 'text-surface-500'
}

// ─── Severity of conflict ─────────────────────────────────────────────────────

function severity(score: number): {
  label: string
  color: string
  bg: string
  border: string
  ring: string
} {
  if (score >= 25) return {
    label: 'Critical',
    color: 'text-against-400',
    bg: 'bg-against-600/15',
    border: 'border-against-500/40',
    ring: 'ring-against-500/20',
  }
  if (score >= 15) return {
    label: 'High',
    color: 'text-against-300',
    bg: 'bg-against-600/10',
    border: 'border-against-500/30',
    ring: 'ring-against-500/15',
  }
  if (score >= 8) return {
    label: 'Moderate',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    ring: 'ring-gold/15',
  }
  return {
    label: 'Low',
    color: 'text-surface-400',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
    ring: 'ring-surface-400/10',
  }
}

// ─── Price bar ────────────────────────────────────────────────────────────────

function PriceBar({ price, label }: { price: number; label: string }) {
  const isAbove50 = price > 50
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-mono text-surface-500 truncate max-w-[80%]">{label}</span>
        <span className={cn(
          'text-xs font-mono font-bold',
          price >= 67 ? 'text-gold' : price >= 55 ? 'text-for-300' : price <= 33 ? 'text-against-400' : 'text-surface-400'
        )}>
          {price}¢
        </span>
      </div>
      <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isAbove50 ? 'bg-for-500' : 'bg-against-500'
          )}
          style={{ width: `${price}%` }}
        />
      </div>
    </div>
  )
}

// ─── Correlation indicator ────────────────────────────────────────────────────

function CorrBadge({ r }: { r: number }) {
  const pct = Math.round(Math.abs(r) * 100)
  return (
    <div className="flex items-center gap-1">
      <TrendingDown className="w-3 h-3 text-against-400" />
      <span className="text-[10px] font-mono text-against-300">{pct}% neg. corr.</span>
    </div>
  )
}

// ─── Conflict card ────────────────────────────────────────────────────────────

function ConflictCard({ pair, index }: { pair: ConflictPair; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const sev = severity(pair.conflict_score)
  const overCount = pair.price_sum - 100

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={cn(
        'rounded-xl border ring-1 overflow-hidden',
        sev.bg,
        sev.border,
        sev.ring,
      )}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left px-4 py-3 flex items-start gap-3"
        aria-expanded={expanded}
      >
        {/* Rank */}
        <span className="font-mono text-xs text-surface-600 mt-0.5 w-5 flex-shrink-0">
          #{index + 1}
        </span>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-2.5">
          {/* Severity + score */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="surface" className={cn('text-[10px] font-mono', sev.color)}>
              {sev.label}
            </Badge>
            <span className="text-[10px] font-mono text-surface-500">
              conflict score {pair.conflict_score.toFixed(1)}
            </span>
            <span className={cn(
              'text-[10px] font-mono',
              overCount > 20 ? 'text-against-400' : 'text-against-300'
            )}>
              +{overCount}¢ over 100
            </span>
          </div>

          {/* Market A */}
          <PriceBar price={pair.market_a.price} label={pair.market_a.statement} />

          {/* VS divider */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-surface-300" />
            <div className="flex items-center gap-1.5 px-2">
              <GitFork className="w-3 h-3 text-surface-500 rotate-90" />
              <CorrBadge r={pair.correlation} />
            </div>
            <div className="flex-1 h-px bg-surface-300" />
          </div>

          {/* Market B */}
          <PriceBar price={pair.market_b.price} label={pair.market_b.statement} />
        </div>

        {/* Chevron */}
        <ChevronDown className={cn(
          'w-4 h-4 text-surface-500 flex-shrink-0 mt-0.5 transition-transform duration-200',
          expanded && 'rotate-180'
        )} />
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-surface-300/50 space-y-3">
              {/* What this means */}
              <div className="mt-3 rounded-lg bg-surface-900/60 border border-surface-300 p-3 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-surface-500" />
                  <span className="text-[10px] font-mono text-surface-400 uppercase tracking-wide">Why this is a conflict</span>
                </div>
                <p className="text-xs text-surface-400 leading-relaxed">
                  These markets historically move in opposite directions (correlation: {pair.correlation.toFixed(2)}),
                  yet both are currently priced above 50¢ — implying both will resolve YES.
                  Historically, users who voted <span className="text-for-300">FOR</span> one tend to vote{' '}
                  <span className="text-against-300">AGAINST</span> the other.
                  The market may be mispricing at least one of these debates.
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-surface-800/50 border border-surface-300 p-2 text-center">
                  <div className={cn('text-sm font-mono font-bold', sev.color)}>
                    {pair.conflict_score.toFixed(1)}
                  </div>
                  <div className="text-[10px] font-mono text-surface-500">conflict score</div>
                </div>
                <div className="rounded-lg bg-surface-800/50 border border-surface-300 p-2 text-center">
                  <div className="text-sm font-mono font-bold text-against-300">
                    {pair.price_sum}¢
                  </div>
                  <div className="text-[10px] font-mono text-surface-500">combined price</div>
                </div>
                <div className="rounded-lg bg-surface-800/50 border border-surface-300 p-2 text-center">
                  <div className="text-sm font-mono font-bold text-surface-300">
                    {pair.shared_voters > 0 ? pair.shared_voters : '—'}
                  </div>
                  <div className="text-[10px] font-mono text-surface-500">shared voters</div>
                </div>
              </div>

              {/* Links */}
              <div className="flex gap-2">
                <Link
                  href={`/exchange/${pair.market_a.id}`}
                  className="flex-1 flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg bg-surface-800 border border-surface-300 hover:bg-surface-700 transition-colors group"
                >
                  <div className="min-w-0">
                    <div className={cn('text-[9px] font-mono uppercase tracking-wide', catColor(pair.market_a.category))}>
                      {pair.market_a.category ?? 'Market'}
                    </div>
                    <div className="text-xs font-mono text-surface-300 truncate group-hover:text-white transition-colors">
                      {pair.market_a.price}¢ · Market A
                    </div>
                  </div>
                  <ArrowRight className="w-3 h-3 text-surface-500 flex-shrink-0" />
                </Link>

                <Link
                  href={`/exchange/${pair.market_b.id}`}
                  className="flex-1 flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg bg-surface-800 border border-surface-300 hover:bg-surface-700 transition-colors group"
                >
                  <div className="min-w-0">
                    <div className={cn('text-[9px] font-mono uppercase tracking-wide', catColor(pair.market_b.category))}>
                      {pair.market_b.category ?? 'Market'}
                    </div>
                    <div className="text-xs font-mono text-surface-300 truncate group-hover:text-white transition-colors">
                      {pair.market_b.price}¢ · Market B
                    </div>
                  </div>
                  <ArrowRight className="w-3 h-3 text-surface-500 flex-shrink-0" />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="rounded-xl bg-surface-900 border border-surface-300 p-3 text-center">
      <div className={cn('text-xl font-mono font-bold', color ?? 'text-white')}>{value}</div>
      <div className="text-[10px] font-mono text-surface-500 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] font-mono text-surface-600 mt-0.5">{sub}</div>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ConflictsClient() {
  const [data, setData] = useState<ConflictsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [minScore, setMinScore] = useState(5)
  const [infoOpen, setInfoOpen] = useState(false)

  const load = useCallback(async (min = minScore) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exchange/conflicts?min=${min}`)
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Could not load conflict data')
    } finally {
      setLoading(false)
    }
  }, [minScore])

  useEffect(() => { load() }, [load])

  const criticalCount  = data?.pairs.filter(p => p.conflict_score >= 25).length ?? 0
  const highCount      = data?.pairs.filter(p => p.conflict_score >= 15 && p.conflict_score < 25).length ?? 0
  const avgPriceSum    = data && data.pairs.length > 0
    ? Math.round(data.pairs.reduce((s, p) => s + p.price_sum, 0) / data.pairs.length)
    : 0

  return (
    <div className="min-h-screen bg-surface-950 text-white">
      <TopBar />

      <div className="max-w-2xl mx-auto px-4 pt-20 pb-28">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 mb-6">
          <Link
            href="/exchange"
            className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Exchange
          </Link>
          <ChevronRight className="w-3 h-3 text-surface-700" />
          <span className="text-xs font-mono text-surface-400">Conflicts</span>
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-against-600/15 border border-against-500/30 flex items-center justify-center flex-shrink-0">
                <Scale className="w-5 h-5 text-against-400" />
              </div>
              <div>
                <h1 className="text-xl font-mono font-bold text-white">Market Conflicts</h1>
                <p className="text-xs font-mono text-surface-500 mt-0.5">
                  Both lean YES — but they can&apos;t both be right
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setInfoOpen(o => !o)}
                className="w-8 h-8 rounded-lg bg-surface-800 border border-surface-300 flex items-center justify-center hover:bg-surface-700 transition-colors"
                aria-label="How this works"
              >
                <Info className="w-4 h-4 text-surface-400" />
              </button>
              <button
                onClick={() => load()}
                disabled={loading}
                className="w-8 h-8 rounded-lg bg-surface-800 border border-surface-300 flex items-center justify-center hover:bg-surface-700 transition-colors disabled:opacity-50"
                aria-label="Refresh"
              >
                <RefreshCw className={cn('w-4 h-4 text-surface-400', loading && 'animate-spin')} />
              </button>
            </div>
          </div>
        </div>

        {/* Explainer */}
        <AnimatePresence>
          {infoOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-5"
            >
              <div className="rounded-xl bg-surface-900 border border-surface-300 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-against-400" />
                  <span className="text-sm font-mono font-semibold text-surface-200">How conflict detection works</span>
                </div>
                <p className="text-xs text-surface-400 leading-relaxed">
                  A <span className="text-against-300 font-semibold">market conflict</span> occurs when two active markets are
                  both priced above 50¢ — meaning the crowd expects both to resolve YES — but they are
                  negatively correlated: users who historically voted FOR one tended to vote AGAINST the other.
                </p>
                <p className="text-xs text-surface-400 leading-relaxed">
                  The <span className="text-gold font-semibold">conflict score</span> combines how much the combined price
                  exceeds 100¢ with how strongly the markets are negatively correlated. A score of 25+ indicates
                  a critical mispricing where at least one market is likely wrong.
                </p>
                <p className="text-xs text-surface-500">
                  Conflict score = (price_A + price_B − 100) × |correlation|
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats */}
        {!loading && data && (
          <div className="grid grid-cols-3 gap-2 mb-6">
            <StatTile
              label="conflicts found"
              value={data.pairs.length}
              sub={`of ${data.total_markets_scanned} markets`}
              color={data.pairs.length > 0 ? 'text-against-400' : 'text-emerald'}
            />
            <StatTile
              label="critical"
              value={criticalCount}
              sub={`+ ${highCount} high`}
              color={criticalCount > 0 ? 'text-against-400' : 'text-surface-500'}
            />
            <StatTile
              label="avg. price sum"
              value={avgPriceSum > 0 ? `${avgPriceSum}¢` : '—'}
              sub={avgPriceSum > 110 ? '10%+ over fair' : undefined}
              color={avgPriceSum > 110 ? 'text-gold' : 'text-surface-300'}
            />
          </div>
        )}

        {/* Skeleton stats while loading */}
        {loading && (
          <div className="grid grid-cols-3 gap-2 mb-6">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-mono text-surface-500">Min. conflict score:</span>
          {[5, 10, 15, 25].map(v => (
            <button
              key={v}
              onClick={() => {
                setMinScore(v)
                load(v)
              }}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-colors',
                minScore === v
                  ? 'bg-against-600/20 border-against-500/40 text-against-300'
                  : 'bg-surface-800 border-surface-300 text-surface-500 hover:text-surface-300'
              )}
            >
              {v}+
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-against-600/10 border border-against-500/30 p-4 text-center mb-4">
            <p className="text-sm text-against-300">{error}</p>
            <button
              onClick={() => load()}
              className="mt-2 text-xs text-surface-400 hover:text-surface-300 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && data?.pairs.length === 0 && (
          <EmptyState
            icon={Scale}
            title="No conflicts detected"
            description={
              minScore > 5
                ? `No market pairs exceed a conflict score of ${minScore}. Try lowering the minimum.`
                : 'All active markets are internally consistent — no contradictory pricing detected.'
            }
            action={
              minScore > 5
                ? {
                    label: 'Show all conflicts',
                    onClick: () => { setMinScore(5); load(5) },
                  }
                : undefined
            }
          />
        )}

        {/* Conflict pairs */}
        {!loading && !error && data && data.pairs.length > 0 && (
          <div className="space-y-4">
            {/* Critical banner */}
            {criticalCount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-against-600/15 border border-against-500/40 p-3 flex items-start gap-2.5"
              >
                <AlertTriangle className="w-4 h-4 text-against-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-against-300">
                  <span className="font-semibold">{criticalCount} critical conflict{criticalCount !== 1 ? 's' : ''} detected.</span>{' '}
                  The markets below show significant internal mispricing. At least one market in each pair
                  is likely incorrectly valued.
                </p>
              </motion.div>
            )}

            {data.pairs.map((pair, i) => (
              <ConflictCard key={`${pair.market_a.id}-${pair.market_b.id}`} pair={pair} index={i} />
            ))}

            {/* Computed at */}
            {data.computed_at && (
              <p className="text-[10px] font-mono text-surface-700 text-center pt-2">
                Scanned {data.total_markets_scanned} markets ·{' '}
                updated {new Date(data.computed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        )}

        {/* Related links */}
        <div className="mt-8 pt-6 border-t border-surface-300">
          <p className="text-[10px] font-mono text-surface-600 uppercase tracking-wide mb-3">Related tools</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: '/exchange/arbitrage',    icon: BarChart2,  label: 'Arbitrage Scanner',   desc: 'Expert vs crowd divergence' },
              { href: '/exchange/correlations', icon: GitFork,    label: 'Correlations Matrix',  desc: 'Price co-movement across markets' },
              { href: '/exchange/near-law',     icon: Zap,        label: 'Near-Law Radar',       desc: 'Markets approaching supermajority' },
              { href: '/exchange/screener',     icon: TrendingUp, label: 'Market Screener',      desc: 'Filter by any signal' },
            ].map(({ href, icon: Icon, label, desc }) => (
              <Link
                key={href}
                href={href}
                className="flex items-start gap-2.5 rounded-xl bg-surface-900 border border-surface-300 p-3 hover:bg-surface-800 hover:border-surface-400 transition-colors group"
              >
                <Icon className="w-4 h-4 text-surface-500 group-hover:text-surface-300 flex-shrink-0 mt-0.5 transition-colors" />
                <div>
                  <div className="text-xs font-mono font-medium text-surface-300 group-hover:text-white transition-colors">
                    {label}
                  </div>
                  <div className="text-[10px] font-mono text-surface-600 mt-0.5">{desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>

      <BottomNav />
    </div>
  )
}
