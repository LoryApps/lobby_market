'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  Brain,
  ExternalLink,
  FileText,
  Flame,
  Gavel,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { SmartTrader, ConsensusSignal, SmartMoneyResponse, TraderPosition } from '@/app/api/exchange/smart-money/route'

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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function priceColor(price: number, status: string): string {
  if (status === 'law') return 'text-gold'
  if (status === 'failed') return 'text-against-400'
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

const GRADE_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  S: { label: 'S', bg: 'bg-gold/15',        text: 'text-gold',        border: 'border-gold/40' },
  A: { label: 'A', bg: 'bg-for-500/15',     text: 'text-for-400',     border: 'border-for-500/40' },
  B: { label: 'B', bg: 'bg-emerald/15',     text: 'text-emerald',     border: 'border-emerald/40' },
  C: { label: 'C', bg: 'bg-surface-300/60', text: 'text-surface-400', border: 'border-surface-400/40' },
  D: { label: 'D', bg: 'bg-against-500/15', text: 'text-against-400', border: 'border-against-500/40' },
}

const STATUS_ICON: Record<string, typeof FileText> = {
  proposed: FileText,
  active: Zap,
  voting: Scale,
  law: Gavel,
  failed: ThumbsDown,
}

const CATEGORY_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
}

function getCatStyle(cat: string | null) {
  return (cat && CATEGORY_STYLE[cat]) ?? { text: 'text-surface-500', bg: 'bg-surface-300/40', border: 'border-surface-400/40' }
}

// ─── Position Chip ─────────────────────────────────────────────────────────────

function PositionChip({ pos }: { pos: TraderPosition }) {
  const isFor = pos.side === 'blue'
  return (
    <Link
      href={`/exchange/${pos.topic_id}`}
      title={pos.statement}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-mono transition-colors flex-shrink-0',
        isFor
          ? 'bg-for-500/10 border-for-500/25 text-for-400 hover:border-for-500/50'
          : 'bg-against-500/10 border-against-500/25 text-against-400 hover:border-against-500/50'
      )}
    >
      {isFor
        ? <ThumbsUp className="h-2.5 w-2.5 flex-shrink-0" aria-hidden="true" />
        : <ThumbsDown className="h-2.5 w-2.5 flex-shrink-0" aria-hidden="true" />
      }
      <span className="line-clamp-1 max-w-[120px]">{pos.statement}</span>
      <span className={cn('ml-0.5 font-bold', priceColor(pos.current_price, pos.status))}>
        {Math.round(pos.current_price)}%
      </span>
    </Link>
  )
}

// ─── Trader Card ──────────────────────────────────────────────────────────────

function TraderCard({ trader, rank }: { trader: SmartTrader; rank: number }) {
  const grade = trader.accuracy_grade ? GRADE_CONFIG[trader.accuracy_grade] : null
  const forPositions = trader.positions.filter((p) => p.side === 'blue')
  const againstPositions = trader.positions.filter((p) => p.side === 'red')

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
      className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden"
    >
      {/* Trader header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-300">
        <span className="flex-shrink-0 text-xs font-mono text-surface-600 w-5 text-center">
          #{rank}
        </span>
        <Link
          href={`/profile/${trader.username}`}
          className="flex items-center gap-2.5 flex-1 min-w-0 group"
        >
          <Avatar
            src={trader.avatar_url}
            fallback={trader.display_name || trader.username}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white group-hover:text-for-400 transition-colors truncate">
              {trader.display_name || trader.username}
            </p>
            <p className="text-xs text-surface-500 truncate">@{trader.username}</p>
          </div>
        </Link>

        {/* Stats */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {grade && (
            <span
              className={cn(
                'flex items-center justify-center h-7 w-7 rounded-lg text-xs font-mono font-bold border',
                grade.bg, grade.text, grade.border
              )}
              title={`Accuracy grade: ${grade.label} (${Math.round((trader.win_rate ?? 0) * 100)}% win rate on ${trader.settled_total} settled positions)`}
            >
              {grade.label}
            </span>
          )}
          <div className="text-right">
            {trader.win_rate !== null ? (
              <>
                <p className="text-xs font-mono font-semibold text-white">
                  {Math.round(trader.win_rate * 100)}%
                </p>
                <p className="text-[10px] font-mono text-surface-600">
                  {trader.settled_correct}/{trader.settled_total}
                </p>
              </>
            ) : (
              <p className="text-[10px] font-mono text-surface-600">
                {trader.settled_total > 0 ? `${trader.settled_total} settled` : 'New'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Positions */}
      {trader.positions.length === 0 ? (
        <div className="px-4 py-3 text-xs text-surface-600 font-mono">
          No active positions
        </div>
      ) : (
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-mono text-surface-600 uppercase tracking-wide">
            <BarChart2 className="h-3 w-3" />
            <span>{trader.positions.length} active position{trader.positions.length !== 1 ? 's' : ''}</span>
            {trader.best_category && (
              <>
                <span className="text-surface-700">·</span>
                <span>Specialist: {trader.best_category}</span>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {trader.positions.map((pos) => (
              <PositionChip key={pos.topic_id} pos={pos} />
            ))}
          </div>
          {(forPositions.length > 0 || againstPositions.length > 0) && (
            <div className="flex items-center gap-3 pt-1 border-t border-surface-300/50">
              <div className="flex items-center gap-1 text-[10px] font-mono text-for-400">
                <ThumbsUp className="h-2.5 w-2.5" />
                <span>{forPositions.length} FOR</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-mono text-against-400">
                <ThumbsDown className="h-2.5 w-2.5" />
                <span>{againstPositions.length} AGAINST</span>
              </div>
              <div className="ml-auto flex items-center gap-1 text-[10px] font-mono text-gold">
                <TrendingUp className="h-2.5 w-2.5" />
                <span>{trader.clout.toLocaleString()} clout</span>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ─── Consensus Signal Card ─────────────────────────────────────────────────────

function SignalCard({ signal, index }: { signal: ConsensusSignal; index: number }) {
  const isStrongFor = signal.conviction === 'strong_for'
  const isStrongAgainst = signal.conviction === 'strong_against'

  const StatusIcon = STATUS_ICON[signal.status] ?? FileText
  const catStyle = getCatStyle(signal.category)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.06 }}
      className={cn(
        'rounded-2xl border overflow-hidden',
        isStrongFor
          ? 'border-for-500/30 bg-for-500/5'
          : isStrongAgainst
          ? 'border-against-500/30 bg-against-500/5'
          : 'border-surface-300 bg-surface-100'
      )}
    >
      <div className="px-4 py-3">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className={cn(
              'flex-shrink-0 mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center',
              isStrongFor
                ? 'bg-for-500/20'
                : isStrongAgainst
                ? 'bg-against-500/20'
                : 'bg-surface-200'
            )}
          >
            <StatusIcon
              className={cn(
                'h-4 w-4',
                isStrongFor
                  ? 'text-for-400'
                  : isStrongAgainst
                  ? 'text-against-400'
                  : 'text-surface-500'
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            <Link
              href={`/exchange/${signal.topic_id}`}
              className={cn(
                'block text-sm font-medium leading-snug line-clamp-2 mb-1.5 transition-colors',
                isStrongFor
                  ? 'text-for-200 hover:text-for-300'
                  : isStrongAgainst
                  ? 'text-against-200 hover:text-against-300'
                  : 'text-white hover:text-for-400'
              )}
            >
              {signal.statement}
            </Link>
            <div className="flex items-center gap-2 flex-wrap">
              {signal.category && (
                <span className={cn('text-[10px] font-mono', catStyle.text)}>
                  {signal.category}
                </span>
              )}
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                  isStrongFor
                    ? 'bg-for-500/15 border-for-500/30 text-for-400'
                    : isStrongAgainst
                    ? 'bg-against-500/15 border-against-500/30 text-against-400'
                    : 'bg-surface-300/60 border-surface-400/40 text-surface-400'
                )}
              >
                {isStrongFor
                  ? <ThumbsUp className="h-2.5 w-2.5" aria-hidden="true" />
                  : isStrongAgainst
                  ? <ThumbsDown className="h-2.5 w-2.5" aria-hidden="true" />
                  : <Scale className="h-2.5 w-2.5" aria-hidden="true" />
                }
                {isStrongFor ? 'Bullish Signal' : isStrongAgainst ? 'Bearish Signal' : 'Mixed Signal'}
              </span>
              <span className="text-[10px] font-mono text-surface-600">
                {signal.signal_strength}% conviction
              </span>
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className={cn('text-sm font-mono font-bold', priceColor(signal.current_price, signal.status))}>
              {Math.round(signal.current_price)}%
            </p>
            <p className="text-[10px] font-mono text-surface-600">price</p>
          </div>
        </div>

        {/* FOR / AGAINST breakdown */}
        <div className="flex items-center gap-3">
          <div className="flex -space-x-1.5">
            {signal.traders.slice(0, 5).map((t, i) => (
              <Link
                key={t.username}
                href={`/profile/${t.username}`}
                title={`@${t.username} is ${t.side === 'blue' ? 'FOR' : 'AGAINST'}`}
                style={{ zIndex: 5 - i }}
              >
                <Avatar
                  src={t.avatar_url}
                  fallback={t.username}
                  size="xs"
                  className={cn(
                    'ring-2 flex-shrink-0',
                    t.side === 'blue' ? 'ring-for-500/60' : 'ring-against-500/60'
                  )}
                />
              </Link>
            ))}
            {signal.traders.length > 5 && (
              <div className="flex items-center justify-center h-6 w-6 rounded-full bg-surface-300 border-2 border-surface-200 text-[9px] font-mono text-surface-500">
                +{signal.traders.length - 5}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 ml-2">
            {signal.for_count > 0 && (
              <div className="flex items-center gap-1 text-xs text-for-400">
                <ThumbsUp className="h-3 w-3" aria-hidden="true" />
                <span>{signal.for_count} FOR</span>
              </div>
            )}
            {signal.against_count > 0 && (
              <div className="flex items-center gap-1 text-xs text-against-400">
                <ThumbsDown className="h-3 w-3" aria-hidden="true" />
                <span>{signal.against_count} AGAINST</span>
              </div>
            )}
          </div>

          <Link
            href={`/exchange/${signal.topic_id}`}
            className="ml-auto flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-white transition-colors"
            aria-label="View market"
          >
            View market
            <ExternalLink className="h-2.5 w-2.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Aggregate row */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
            <Skeleton className="h-6 w-12 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      {/* Trader cards */}
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-300">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-1.5" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-7 w-7 rounded-lg" />
          </div>
          <div className="px-4 py-3">
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3].map((j) => (
                <Skeleton key={j} className="h-7 w-36 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SmartMoneyClient() {
  const [data, setData] = useState<SmartMoneyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeTab, setActiveTab] = useState<'traders' | 'signals'>('signals')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/exchange/smart-money')
      if (!res.ok) throw new Error('Failed')
      const json = await res.json() as SmartMoneyResponse
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const agg = data?.aggregate

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-4 pb-28">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href="/exchange"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to Exchange"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple" aria-hidden="true" />
              Smart Money
            </h1>
            <p className="text-xs text-surface-500 mt-0.5">
              Where high-accuracy traders are positioning in the civic market
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            aria-label="Refresh smart money data"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg',
              'bg-surface-200 text-surface-500',
              'hover:bg-surface-300 hover:text-white transition-colors',
              'disabled:opacity-40'
            )}
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Aggregate stats row */}
        {!loading && agg && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-2.5 mb-5"
          >
            <div className="rounded-xl bg-surface-100 border border-surface-300 px-3 py-3 text-center">
              <p className="text-lg font-bold font-mono text-for-400">
                {agg.for_positions}
              </p>
              <p className="text-[10px] font-mono text-surface-500 mt-0.5">FOR positions</p>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 px-3 py-3 text-center">
              <p className="text-lg font-bold font-mono text-against-400">
                {agg.against_positions}
              </p>
              <p className="text-[10px] font-mono text-surface-500 mt-0.5">AGAINST positions</p>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 px-3 py-3 text-center">
              <p className={cn('text-lg font-bold font-mono', agg.avg_win_rate !== null ? 'text-emerald' : 'text-surface-500')}>
                {agg.avg_win_rate !== null ? `${Math.round(agg.avg_win_rate * 100)}%` : '—'}
              </p>
              <p className="text-[10px] font-mono text-surface-500 mt-0.5">avg win rate</p>
            </div>
          </motion.div>
        )}

        {/* Breadcrumb Nav back to Exchange */}
        <div className="flex items-center gap-2 text-[10px] font-mono text-surface-600 mb-4">
          <Link href="/exchange" className="hover:text-white transition-colors">Exchange</Link>
          <ArrowRight className="h-2.5 w-2.5" />
          <span className="text-white">Smart Money</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-surface-200 rounded-xl mb-5" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'signals'}
            onClick={() => setActiveTab('signals')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'signals'
                ? 'bg-surface-100 text-white shadow-sm'
                : 'text-surface-500 hover:text-surface-700'
            )}
          >
            <Flame className="h-3.5 w-3.5" aria-hidden="true" />
            Signals
            {data && data.consensus_signals.length > 0 && (
              <span className="ml-0.5 text-[10px] font-mono bg-purple/20 text-purple px-1.5 py-0.5 rounded-full">
                {data.consensus_signals.length}
              </span>
            )}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'traders'}
            onClick={() => setActiveTab('traders')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'traders'
                ? 'bg-surface-100 text-white shadow-sm'
                : 'text-surface-500 hover:text-surface-700'
            )}
          >
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
            Top Traders
            {data && data.top_traders.length > 0 && (
              <span className="ml-0.5 text-[10px] font-mono bg-surface-300 text-surface-500 px-1.5 py-0.5 rounded-full">
                {data.top_traders.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-xl bg-surface-200 flex items-center justify-center mb-4">
              <Brain className="h-5 w-5 text-surface-500" />
            </div>
            <p className="text-surface-500 text-sm mb-3">Unable to load smart money data.</p>
            <button
              onClick={() => load()}
              className="flex items-center gap-2 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        ) : !data ? null : activeTab === 'signals' ? (
          /* ── Consensus Signals Tab ── */
          <div className="space-y-3">
            {data.consensus_signals.length === 0 ? (
              <EmptyState
                icon={Scale}
                title="No consensus signals yet"
                description="Consensus signals appear when multiple top traders position on the same market. Check back as more positions are taken."
              />
            ) : (
              <>
                <p className="text-xs text-surface-500 font-mono mb-3">
                  Markets where qualified traders agree — sorted by conviction strength.
                </p>
                {data.consensus_signals.map((signal, i) => (
                  <SignalCard key={signal.topic_id} signal={signal} index={i} />
                ))}
              </>
            )}
          </div>
        ) : (
          /* ── Top Traders Tab ── */
          <div className="space-y-3">
            {data.top_traders.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No traders yet"
                description="Top traders appear here once users establish a track record of civic positions."
              />
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-600">
                    <Award className="h-3 w-3" />
                    <span>Accuracy grades based on settled positions</span>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    {['S', 'A', 'B', 'C', 'D'].map((g) => {
                      const cfg = GRADE_CONFIG[g]
                      return (
                        <span
                          key={g}
                          className={cn(
                            'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border',
                            cfg.bg, cfg.text, cfg.border
                          )}
                        >
                          {g}
                        </span>
                      )
                    })}
                  </div>
                </div>
                {data.top_traders.map((trader, i) => (
                  <TraderCard key={trader.id} trader={trader} rank={i + 1} />
                ))}
              </>
            )}
          </div>
        )}

        {/* Footer timestamp */}
        {data && (
          <p className="text-center text-[10px] font-mono text-surface-700 mt-6">
            Updated {relTime(data.as_of)} · Refreshes every 2 minutes
          </p>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
