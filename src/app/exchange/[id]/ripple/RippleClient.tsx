'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart2,
  ChevronRight,
  Droplets,
  GitCompare,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { CorrelatedTopic, TopicCorrelationsResponse } from '@/app/api/topics/[id]/correlations/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  topicId: string
  statement: string
  category: string | null
  status: string
  price: number
  totalVotes: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics:     'text-gold',
  Politics:      'text-for-400',
  Technology:    'text-purple',
  Science:       'text-emerald',
  Ethics:        'text-against-400',
  Philosophy:    'text-for-300',
  Culture:       'text-gold',
  Health:        'text-against-300',
  Environment:   'text-emerald',
  Education:     'text-purple',
}

function strengthLabel(abs: number): string {
  if (abs >= 0.75) return 'Very Strong'
  if (abs >= 0.55) return 'Strong'
  if (abs >= 0.35) return 'Moderate'
  return 'Weak'
}

function fmtVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

// ─── Correlation Bar ─────────────────────────────────────────────────────────

function CorrelationBar({ value }: { value: number }) {
  const abs = Math.abs(value)
  const aligned = value >= 0
  const widthPct = Math.round(abs * 100)

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-surface-300 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${widthPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={cn(
            'h-full rounded-full',
            aligned ? 'bg-for-500' : 'bg-against-500',
          )}
        />
      </div>
      <span
        className={cn(
          'text-[10px] font-mono font-bold w-7 text-right tabular-nums',
          aligned ? 'text-for-400' : 'text-against-400',
        )}
      >
        {value >= 0 ? '+' : ''}{value.toFixed(2)}
      </span>
    </div>
  )
}

// ─── Price Bar ───────────────────────────────────────────────────────────────

function PriceBar({ price }: { price: number }) {
  const against = 100 - price
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-mono text-for-400 w-7 text-right tabular-nums">{price}¢</span>
      <div className="flex-1 h-1 bg-surface-300 rounded-full overflow-hidden">
        <div className="h-full bg-for-500 rounded-full" style={{ width: `${price}%` }} />
      </div>
      <span className="text-[10px] font-mono text-against-400 w-7 tabular-nums">{against}¢</span>
    </div>
  )
}

// ─── Market Card ─────────────────────────────────────────────────────────────

function MarketCard({ market, index }: { market: CorrelatedTopic; index: number }) {
  const aligned = market.direction === 'aligned'
  const abs = Math.abs(market.correlation)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
    >
      <Link
        href={`/exchange/${market.id}`}
        className={cn(
          'block rounded-xl border p-4 transition-all duration-200 group',
          'bg-surface-100 hover:bg-surface-200',
          aligned
            ? 'border-for-500/20 hover:border-for-500/40'
            : 'border-against-500/20 hover:border-against-500/40',
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-mono text-white leading-snug line-clamp-2 group-hover:text-surface-50 transition-colors">
              {market.statement}
            </p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-1.5 mt-0.5">
            {market.category && (
              <span className={cn('text-[10px] font-mono', CATEGORY_COLOR[market.category] ?? 'text-surface-500')}>
                {market.category}
              </span>
            )}
            <ChevronRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-surface-400 transition-colors" />
          </div>
        </div>

        {/* Price bar */}
        <div className="mb-3">
          <PriceBar price={Math.round(market.blue_pct ?? 50)} />
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Correlation strength */}
            <div className="flex items-center gap-1">
              {aligned ? (
                <ThumbsUp className="h-3 w-3 text-for-500" />
              ) : (
                <ThumbsDown className="h-3 w-3 text-against-500" />
              )}
              <span className={cn(
                'text-[11px] font-mono font-semibold',
                aligned ? 'text-for-400' : 'text-against-400',
              )}>
                {strengthLabel(abs)}
              </span>
            </div>
            {/* Shared voters */}
            <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <Users className="h-3 w-3" />
              <span>{market.shared_voters.toLocaleString()} shared</span>
            </div>
          </div>

          {/* Status */}
          <span className={cn(
            'text-[10px] font-mono px-2 py-0.5 rounded-full',
            market.status === 'law'
              ? 'bg-gold/15 text-gold'
              : market.status === 'voting'
              ? 'bg-purple/15 text-purple'
              : market.status === 'failed'
              ? 'bg-surface-300 text-surface-500'
              : 'bg-for-500/10 text-for-400',
          )}>
            {STATUS_LABEL[market.status] ?? market.status}
          </span>
        </div>

        {/* Correlation bar */}
        <div className="mt-3 pt-3 border-t border-surface-300/60">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono text-surface-500">
              {aligned ? 'MOVES WITH' : 'MOVES AGAINST'}
            </span>
            <span className="text-[10px] font-mono text-surface-500">
              {Math.round(market.alignment_rate * 100)}% alignment
            </span>
          </div>
          <CorrelationBar value={market.correlation} />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 animate-pulse">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-6 w-10" />
          </div>
        ))}
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3 animate-pulse">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-1 w-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RippleClient({ topicId, statement, category, status, price, totalVotes }: Props) {
  const [data, setData] = useState<TopicCorrelationsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<'all' | 'aligned' | 'opposed'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/correlations?limit=20`)
      if (!res.ok) throw new Error(`${res.status}`)
      const json = (await res.json()) as TopicCorrelationsResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { void load() }, [load])

  const allCorrelations = data?.correlations ?? []
  const aligned = allCorrelations.filter((c) => c.direction === 'aligned')
  const opposed = allCorrelations.filter((c) => c.direction === 'opposed')

  const filtered =
    activeFilter === 'aligned'
      ? aligned
      : activeFilter === 'opposed'
      ? opposed
      : allCorrelations

  const avgCorrelation =
    allCorrelations.length > 0
      ? allCorrelations.reduce((sum, c) => sum + Math.abs(c.correlation), 0) / allCorrelations.length
      : 0

  return (
    <div className="flex flex-col min-h-screen bg-surface-0">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-24 pt-4">
        {/* ── Back nav ── */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href={`/exchange/${topicId}`}
            className="flex items-center gap-1.5 text-surface-500 hover:text-white transition-colors text-xs font-mono"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Market
          </Link>
          <span className="text-surface-600 text-xs">/</span>
          <span className="text-xs font-mono text-surface-400">Ripple Analysis</span>
        </div>

        {/* ── Hero ── */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-5">
          <div className="flex items-start gap-3 mb-4">
            <div className={cn(
              'p-2 rounded-lg flex-shrink-0',
              'bg-for-500/10 border border-for-500/20',
            )}>
              <Droplets className="h-4 w-4 text-for-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">Ripple Analysis</span>
                {category && (
                  <span className={cn('text-[10px] font-mono', CATEGORY_COLOR[category] ?? 'text-surface-500')}>
                    {category}
                  </span>
                )}
              </div>
              <p className="text-sm font-mono text-white leading-snug line-clamp-2">
                {statement}
              </p>
            </div>
          </div>

          <PriceBar price={price} />

          <div className="flex items-center gap-3 mt-2 mb-3">
            <span className={cn(
              'text-[10px] font-mono px-2 py-0.5 rounded-full',
              status === 'law'
                ? 'bg-gold/15 text-gold'
                : status === 'voting'
                ? 'bg-purple/15 text-purple'
                : status === 'failed'
                ? 'bg-surface-300 text-surface-500'
                : 'bg-for-500/10 text-for-400',
            )}>
              {STATUS_LABEL[status] ?? status}
            </span>
            <span className="text-[10px] font-mono text-surface-500">
              {fmtVotes(totalVotes)} votes
            </span>
          </div>

          <p className="text-[11px] font-mono text-surface-500 leading-relaxed">
            Shows which civic markets move in sync with this one — or diverge. Markets that share voters
            with the same conviction reveal hidden patterns in how ideas travel across the civic landscape.
          </p>
        </div>

        {/* ── Stats ── */}
        {!loading && data && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-3 mb-5"
          >
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-1">Correlated</p>
              <p className="text-xl font-mono font-bold text-white">{allCorrelations.length}</p>
            </div>
            <div className="rounded-xl bg-surface-100 border border-for-500/20 p-3 text-center">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-1">Aligned</p>
              <p className="text-xl font-mono font-bold text-for-400">{aligned.length}</p>
            </div>
            <div className="rounded-xl bg-surface-100 border border-against-500/20 p-3 text-center">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-1">Opposed</p>
              <p className="text-xl font-mono font-bold text-against-400">{opposed.length}</p>
            </div>
          </motion.div>
        )}

        {/* ── Filter tabs ── */}
        {!loading && allCorrelations.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            {(
              [
                { id: 'all', label: 'All', count: allCorrelations.length },
                { id: 'aligned', label: 'Aligned', count: aligned.length },
                { id: 'opposed', label: 'Opposed', count: opposed.length },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all',
                  activeFilter === tab.id
                    ? tab.id === 'aligned'
                      ? 'bg-for-500/15 text-for-400 border border-for-500/30'
                      : tab.id === 'opposed'
                      ? 'bg-against-500/15 text-against-400 border border-against-500/30'
                      : 'bg-surface-200 text-white border border-surface-400'
                    : 'text-surface-500 hover:text-surface-400 border border-transparent',
                )}
              >
                {tab.label}
                <span className={cn(
                  'text-[10px] px-1 rounded',
                  activeFilter === tab.id ? 'bg-surface-300' : 'bg-surface-200',
                )}>
                  {tab.count}
                </span>
              </button>
            ))}

            {/* Avg correlation */}
            {avgCorrelation > 0 && (
              <div className="ml-auto flex items-center gap-1 text-[10px] font-mono text-surface-500">
                <Scale className="h-3 w-3" />
                avg {avgCorrelation.toFixed(2)}
              </div>
            )}
          </div>
        )}

        {/* ── Content ── */}
        {loading ? (
          <PageSkeleton />
        ) : error ? (
          <div className="rounded-xl bg-surface-100 border border-surface-300 p-6 text-center">
            <p className="text-sm font-mono text-surface-500 mb-3">Failed to load correlation data.</p>
            <button
              onClick={load}
              className="flex items-center gap-2 mx-auto text-xs font-mono text-for-400 hover:text-for-300"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : !data?.has_data || filtered.length === 0 ? (
          <EmptyState
            icon={GitCompare}
            iconColor="text-surface-500"
            iconBg="bg-surface-200"
            iconBorder="border-surface-300"
            title="No ripple data yet"
            description={
              activeFilter !== 'all'
                ? `No ${activeFilter} markets found. Try viewing all correlations.`
                : "This market hasn't accumulated enough shared voter data to show correlations. Come back as more citizens engage."
            }
            action={
              activeFilter !== 'all'
                ? { label: 'Show all', onClick: () => setActiveFilter('all') }
                : { label: 'Browse exchange', href: '/exchange' }
            }
          />
        ) : (
          <div className="space-y-3">
            {/* Section headers */}
            {activeFilter === 'all' && aligned.length > 0 && (
              <div className="flex items-center gap-2 mb-1">
                <ThumbsUp className="h-3.5 w-3.5 text-for-500" />
                <span className="text-[11px] font-mono text-for-400 font-semibold uppercase tracking-wider">
                  Moves with this market
                </span>
              </div>
            )}
            <AnimatePresence mode="popLayout">
              {activeFilter !== 'opposed' && aligned.map((market, i) => (
                <MarketCard key={market.id} market={market} index={i} />
              ))}
            </AnimatePresence>

            {activeFilter === 'all' && opposed.length > 0 && aligned.length > 0 && (
              <div className="flex items-center gap-2 mt-4 mb-1">
                <ThumbsDown className="h-3.5 w-3.5 text-against-500" />
                <span className="text-[11px] font-mono text-against-400 font-semibold uppercase tracking-wider">
                  Diverges from this market
                </span>
              </div>
            )}
            <AnimatePresence mode="popLayout">
              {activeFilter !== 'aligned' && opposed.map((market, i) => (
                <MarketCard key={market.id} market={market} index={aligned.length + i} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* ── Footer links ── */}
        {!loading && (
          <div className="mt-6 pt-5 border-t border-surface-300/60 flex flex-wrap items-center gap-3">
            <Link
              href={`/exchange/${topicId}`}
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <BarChart2 className="h-3.5 w-3.5" />
              Market overview
            </Link>
            <Link
              href={`/topic/${topicId}/correlations`}
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <Users className="h-3.5 w-3.5" />
              Full voter analysis
            </Link>
            <Link
              href={`/exchange/${topicId}/similar`}
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <GitCompare className="h-3.5 w-3.5" />
              Similar markets
            </Link>
            <Link
              href="/exchange/correlations"
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors ml-auto"
            >
              Platform correlations
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
