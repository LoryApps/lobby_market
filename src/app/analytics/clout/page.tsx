'use client'

/**
 * /analytics/clout — Clout Economy Analytics
 *
 * Personal breakdown of how you earn, spend, and gift Clout on the platform.
 * Shows monthly trend, top earning sources, spending categories, and your
 * current rank among all citizens.
 *
 * Distinct from:
 *   /clout           — public ledger of all transactions + gift UI
 *   /analytics       — overall civic snapshot with clout balance
 *   /leaderboard     — all-time top clout holders
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
  Award,
  BarChart2,
  ChevronRight,
  Coins,
  ExternalLink,
  Flame,
  Gift,
  Minus,
  RefreshCw,
  Star,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CloutAnalyticsData, CloutMonthlyPoint, CloutReasonStat, CloutRecentTx } from '@/app/api/analytics/clout/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// ─── Monthly bar chart ────────────────────────────────────────────────────────

function MonthlyChart({ monthly }: { monthly: CloutMonthlyPoint[] }) {
  const maxEarned = Math.max(...monthly.map((m) => m.earned), 1)

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-1 h-28">
        {monthly.map((m) => {
          const earnH = Math.round((m.earned / maxEarned) * 100)
          const isPositive = m.net >= 0
          return (
            <div
              key={m.month_key}
              className="flex-1 flex flex-col items-center gap-0.5 group"
              title={`${m.month}: +${m.earned} earned, −${m.spent} spent, net ${m.net >= 0 ? '+' : ''}${m.net}`}
            >
              <div className="w-full flex flex-col justify-end" style={{ height: '100%' }}>
                <div
                  className={cn(
                    'w-full rounded-sm transition-all',
                    isPositive
                      ? 'bg-gold/70 group-hover:bg-gold'
                      : 'bg-against-500/50 group-hover:bg-against-500/70'
                  )}
                  style={{ height: `${Math.max(earnH, 4)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between">
        <span className="text-[10px] font-mono text-surface-600">{monthly[0]?.month}</span>
        <span className="text-[10px] font-mono text-surface-600">{monthly[monthly.length - 1]?.month}</span>
      </div>
      <div className="flex items-center gap-4 text-[11px] font-mono text-surface-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-gold/70" />Gold bar = clout earned
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-against-500/50" />Red = spent more than earned
        </span>
      </div>
    </div>
  )
}

// ─── Reason pill ──────────────────────────────────────────────────────────────

function ReasonBar({ stat, maxTotal }: { stat: CloutReasonStat; maxTotal: number }) {
  const pct = Math.round((stat.total / Math.max(maxTotal, 1)) * 100)
  const isEarn = stat.type === 'earned'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono text-surface-600 truncate flex-1">{stat.reason}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-mono text-surface-500">×{stat.count}</span>
          <span className={cn('text-xs font-mono font-bold', isEarn ? 'text-gold' : 'text-against-400')}>
            {isEarn ? '+' : '−'}{stat.total}
          </span>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-surface-300">
        <div
          className={cn('h-full rounded-full transition-all', isEarn ? 'bg-gold/70' : 'bg-against-500/60')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Transaction row ──────────────────────────────────────────────────────────

const TX_CONFIG: Record<string, { color: string; bg: string; label: string; sign: string }> = {
  earned:   { color: 'text-emerald', bg: 'bg-emerald/10 border-emerald/30', label: 'EARNED',   sign: '+' },
  spent:    { color: 'text-against-400', bg: 'bg-against-500/10 border-against-500/30', label: 'SPENT',    sign: '−' },
  gifted:   { color: 'text-purple', bg: 'bg-purple/10 border-purple/30', label: 'GIFTED',   sign: '−' },
  refunded: { color: 'text-for-400', bg: 'bg-for-500/10 border-for-500/30', label: 'REFUNDED', sign: '+' },
}

function TxRow({ tx }: { tx: CloutRecentTx }) {
  const cfg = TX_CONFIG[tx.type] ?? TX_CONFIG.earned
  const isPositive = tx.type === 'earned' || tx.type === 'refunded'
  return (
    <div className="flex items-center gap-3 py-3 border-b border-surface-300/50 last:border-0">
      <div className={cn('flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg border text-[10px] font-mono font-bold', cfg.bg, cfg.color)}>
        {cfg.sign === '+' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-mono text-white truncate">{tx.reason}</p>
        <p className="text-[11px] font-mono text-surface-500">{relativeTime(tx.created_at)}</p>
      </div>
      <span className={cn('text-sm font-mono font-bold flex-shrink-0', isPositive ? 'text-emerald' : 'text-against-400')}>
        {cfg.sign}{Math.abs(tx.amount)}
      </span>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CloutSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-8 w-20 mb-1" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
        <Skeleton className="h-4 w-28 mb-4" />
        <Skeleton className="h-28 w-full mb-2" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-3">
            <Skeleton className="h-4 w-32 mb-2" />
            {[0, 1, 2, 3].map((j) => <Skeleton key={j} className="h-7 w-full" />)}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CloutAnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<CloutAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/clout', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Could not load Clout analytics.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const displayedTx = showAll ? data?.recent_tx : data?.recent_tx.slice(0, 10)

  const maxEarn = Math.max(...(data?.top_earn_reasons.map((r) => r.total) ?? [1]), 1)
  const maxSpend = Math.max(...(data?.top_spend_reasons.map((r) => r.total) ?? [1]), 1)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <Link
            href="/analytics"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to analytics"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
            <Coins className="h-5 w-5 text-gold" />
          </div>
          <div className="min-w-0">
            <h1 className="font-mono text-xl font-bold text-white leading-tight">Clout Economy</h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">How you earn, spend, and gift civic currency</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            className="ml-auto flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {loading && <CloutSkeleton />}

        {error && !loading && (
          <EmptyState
            icon={Coins}
            title="Could not load Clout analytics"
            description={error}
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {data && !loading && (
          <AnimatePresence mode="wait">
            <motion.div
              key="clout-data"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-5"
            >

              {/* ── Summary stats ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Balance', value: data.balance, sub: 'current', color: 'text-gold', icon: Coins },
                  { label: 'Earned', value: data.total_earned, sub: 'all-time', color: 'text-emerald', icon: ArrowUp },
                  { label: 'Spent', value: data.total_spent, sub: 'invested', color: 'text-against-400', icon: ArrowDown },
                  { label: 'Gifted', value: data.total_gifted, sub: 'given away', color: 'text-purple', icon: Gift },
                ].map(({ label, value, sub, color, icon: Icon }) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">
                      <Icon className="h-3 w-3" aria-hidden="true" />
                      {label}
                    </div>
                    <div className={cn('text-2xl font-mono font-bold', color)}>
                      <AnimatedNumber value={value} />
                    </div>
                    <div className="text-[11px] font-mono text-surface-500 mt-0.5">{sub}</div>
                  </motion.div>
                ))}
              </div>

              {/* ── Rank + streak ── */}
              <div className="grid grid-cols-2 gap-3">
                {data.clout_rank !== null && data.total_users !== null && (
                  <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex items-center gap-4">
                    <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-xl bg-gold/10 border border-gold/30">
                      <Trophy className="h-5 w-5 text-gold" />
                    </div>
                    <div>
                      <div className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-1">Clout Rank</div>
                      <div className="text-xl font-mono font-bold text-white">{ordinal(data.clout_rank)}</div>
                      <div className="text-[11px] font-mono text-surface-500">of {data.total_users?.toLocaleString()} citizens</div>
                    </div>
                  </div>
                )}
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex items-center gap-4">
                  <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-xl bg-against-500/10 border border-against-500/30">
                    <Flame className="h-5 w-5 text-against-400" />
                  </div>
                  <div>
                    <div className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-1">Earning Streak</div>
                    <div className="text-xl font-mono font-bold text-white">{data.earning_streak}</div>
                    <div className="text-[11px] font-mono text-surface-500">
                      {data.earning_streak === 1 ? 'month' : 'months'} in a row
                    </div>
                  </div>
                </div>
                {data.best_month && (
                  <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex items-center gap-4 col-span-2 sm:col-span-1">
                    <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-xl bg-gold/10 border border-gold/30">
                      <Star className="h-5 w-5 text-gold" />
                    </div>
                    <div>
                      <div className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-1">Best Month</div>
                      <div className="text-xl font-mono font-bold text-gold">+{data.best_month.earned}</div>
                      <div className="text-[11px] font-mono text-surface-500">{data.best_month.month}</div>
                    </div>
                  </div>
                )}
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex items-center gap-4 col-span-2 sm:col-span-1">
                  <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-xl bg-purple/10 border border-purple/30">
                    <BarChart2 className="h-5 w-5 text-purple" />
                  </div>
                  <div>
                    <div className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-1">Transactions</div>
                    <div className="text-xl font-mono font-bold text-white">{data.tx_count}</div>
                    <div className="text-[11px] font-mono text-surface-500">all-time</div>
                  </div>
                </div>
              </div>

              {/* ── Monthly chart ── */}
              {data.monthly.some((m) => m.earned > 0) && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
                  <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-5">
                    <TrendingUp className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                    Monthly Clout (last 12 months)
                  </div>
                  <MonthlyChart monthly={data.monthly} />
                </div>
              )}

              {/* ── Top earning / spending sources ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.top_earn_reasons.length > 0 && (
                  <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
                    <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                      <Zap className="h-3.5 w-3.5 text-emerald" aria-hidden="true" />
                      Top Earning Sources
                    </div>
                    <div className="space-y-3">
                      {data.top_earn_reasons.map((stat) => (
                        <ReasonBar key={stat.reason} stat={stat} maxTotal={maxEarn} />
                      ))}
                    </div>
                  </div>
                )}

                {data.top_spend_reasons.length > 0 && (
                  <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
                    <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                      <Award className="h-3.5 w-3.5 text-against-400" aria-hidden="true" />
                      Top Spending Uses
                    </div>
                    <div className="space-y-3">
                      {data.top_spend_reasons.map((stat) => (
                        <ReasonBar key={stat.reason} stat={stat} maxTotal={maxSpend} />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Recent transactions ── */}
              {data.recent_tx.length > 0 ? (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider">
                      <Coins className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                      Recent Transactions
                    </div>
                    <Link
                      href="/clout"
                      className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
                    >
                      Full ledger <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                  <div>
                    {displayedTx?.map((tx) => <TxRow key={tx.id} tx={tx} />)}
                  </div>
                  {data.recent_tx.length > 10 && (
                    <button
                      onClick={() => setShowAll((v) => !v)}
                      className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                    >
                      {showAll ? (
                        <><Minus className="h-3.5 w-3.5" />Show less</>
                      ) : (
                        <><ChevronRight className="h-3.5 w-3.5" />Show {data.recent_tx.length - 10} more</>
                      )}
                    </button>
                  )}
                </div>
              ) : (
                <EmptyState
                  icon={Coins}
                  title="No clout transactions yet"
                  description="Start voting, writing arguments, and participating in debates to earn Clout."
                  action={{ label: 'Go to feed', href: '/' }}
                />
              )}

              {/* ── CTA row ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between rounded-2xl bg-surface-100 border border-gold/20 p-5">
                  <div>
                    <p className="text-sm font-mono font-semibold text-white">See the full economy</p>
                    <p className="text-xs font-mono text-surface-500 mt-0.5">Public ledger, gift Clout to citizens</p>
                  </div>
                  <Link
                    href="/clout"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gold/10 border border-gold/30 text-gold text-xs font-mono font-semibold hover:bg-gold/20 transition-colors flex-shrink-0"
                  >
                    Ledger <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-surface-100 border border-gold/20 p-5">
                  <div>
                    <p className="text-sm font-mono font-semibold text-white">Clout Rankings</p>
                    <p className="text-xs font-mono text-surface-500 mt-0.5">Top holders, earners, and givers</p>
                  </div>
                  <Link
                    href="/leaderboard/clout"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gold/10 border border-gold/30 text-gold text-xs font-mono font-semibold hover:bg-gold/20 transition-colors flex-shrink-0"
                  >
                    Rankings <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

            </motion.div>
          </AnimatePresence>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
