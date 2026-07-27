'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  BarChart2,
  Brain,
  ChevronRight,
  Crown,
  Gavel,
  Minus,
  RefreshCw,
  Shield,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { SmartMoneyData, SmartSignal, SmartTrader } from '@/app/api/exchange/[id]/smart-money/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_MS = 90_000

// ─── Signal config ────────────────────────────────────────────────────────────

const SIGNAL_CONFIG: Record<SmartSignal, {
  label: string
  sublabel: string
  color: string
  bg: string
  border: string
  barColor: string
  icon: React.ComponentType<{ className?: string }>
  arrow: 'up' | 'down' | 'flat' | 'eq'
}> = {
  strong_bull: {
    label: 'Strong Bull',
    sublabel: 'Smart money strongly favours FOR — diverging from crowd',
    color: 'text-for-300',
    bg: 'bg-for-600/20',
    border: 'border-for-500/50',
    barColor: 'bg-for-500',
    icon: TrendingUp,
    arrow: 'up',
  },
  bull: {
    label: 'Bullish',
    sublabel: 'Smart money leans FOR',
    color: 'text-for-400',
    bg: 'bg-for-600/10',
    border: 'border-for-500/30',
    barColor: 'bg-for-500',
    icon: ArrowUpRight,
    arrow: 'up',
  },
  neutral: {
    label: 'Neutral',
    sublabel: 'Smart money is evenly split — no clear signal',
    color: 'text-surface-400',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
    barColor: 'bg-surface-400',
    icon: Minus,
    arrow: 'flat',
  },
  bear: {
    label: 'Bearish',
    sublabel: 'Smart money leans AGAINST',
    color: 'text-against-400',
    bg: 'bg-against-600/10',
    border: 'border-against-500/30',
    barColor: 'bg-against-500',
    icon: ArrowDownRight,
    arrow: 'down',
  },
  strong_bear: {
    label: 'Strong Bear',
    sublabel: 'Smart money strongly opposes — diverging from crowd',
    color: 'text-against-300',
    bg: 'bg-against-600/20',
    border: 'border-against-500/50',
    barColor: 'bg-against-500',
    icon: TrendingDown,
    arrow: 'down',
  },
  aligned: {
    label: 'Aligned',
    sublabel: 'Smart money agrees with the crowd',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    barColor: 'bg-emerald',
    icon: Sparkles,
    arrow: 'eq',
  },
}

// ─── Role config ─────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  elder:         { label: 'Elder',        color: 'text-gold',        icon: Crown  },
  troll_catcher: { label: 'Troll Catcher', color: 'text-emerald',    icon: Shield },
  debator:       { label: 'Debator',      color: 'text-for-400',     icon: Zap    },
  person:        { label: 'Citizen',      color: 'text-surface-500', icon: Users  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatClout(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

// ─── Trader Row ───────────────────────────────────────────────────────────────

function TraderRow({ trader }: { trader: SmartTrader }) {
  const role = ROLE_CONFIG[trader.role] ?? ROLE_CONFIG.person
  const RoleIcon = role.icon
  const isBull = trader.side === 'for'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border transition-colors',
        isBull
          ? 'bg-for-900/20 border-for-700/30 hover:border-for-500/40'
          : 'bg-against-900/20 border-against-700/30 hover:border-against-500/40',
      )}
    >
      <Link href={`/profile/${trader.username}`} className="flex-shrink-0">
        <Avatar
          src={trader.avatar_url}
          fallback={trader.display_name || trader.username}
          size="sm"
        />
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link
            href={`/profile/${trader.username}`}
            className="text-sm font-semibold text-white hover:text-for-300 transition-colors truncate"
          >
            {trader.display_name || trader.username}
          </Link>
          <span className={cn('flex items-center gap-0.5 text-[10px] font-mono font-semibold', role.color)}>
            <RoleIcon className="h-2.5 w-2.5" />
            {role.label}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-surface-500">
          <span className="font-mono">{formatClout(trader.clout)} clout</span>
          <span>·</span>
          <span>{relTime(trader.voted_at)}</span>
        </div>
      </div>

      <div className={cn(
        'flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono font-bold',
        isBull
          ? 'bg-for-500/20 text-for-300 border border-for-500/40'
          : 'bg-against-500/20 text-against-300 border border-against-500/40',
      )}>
        {isBull ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
        {isBull ? 'FOR' : 'AGAINST'}
      </div>
    </motion.div>
  )
}

// ─── Mini stat ────────────────────────────────────────────────────────────────

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3 text-center">
      <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-white mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-surface-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SmartMoneyClient({ id }: { id: string }) {
  const [data, setData] = useState<SmartMoneyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'all' | 'for' | 'against'>('all')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/exchange/${id}/smart-money`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json: SmartMoneyData = await res.json()
      setData(json)
      setError(null)
    } catch {
      setError('Could not load smart money data.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
    const iv = setInterval(load, REFRESH_MS)
    return () => clearInterval(iv)
  }, [load])

  const sm = data?.smart_money
  const topic = data?.topic
  const signal = sm ? SIGNAL_CONFIG[sm.signal] : null
  const SignalIcon = signal?.icon ?? Minus

  const displayTraders =
    tab === 'for' ? (data?.for_traders ?? []) :
    tab === 'against' ? (data?.against_traders ?? []) :
    (data?.all_traders ?? [])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-4 pb-28 space-y-5">

        {/* Back + title */}
        <div className="flex items-center gap-3">
          <Link
            href={`/exchange/${id}`}
            className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Market
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-surface-600" />
          <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
            <Brain className="h-4 w-4 text-emerald" />
            Smart Money
          </div>
        </div>

        {/* Topic header */}
        {topic && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
            <p className="text-xs font-mono text-surface-500 mb-1">
              {topic.category ?? 'Uncategorised'} · {topic.status.toUpperCase()}
            </p>
            <p className="text-base font-semibold text-white leading-snug">{topic.statement}</p>
            <div className="flex items-center gap-3 mt-3 text-sm">
              <span className="text-for-300 font-mono font-bold">{topic.price}¢ FOR</span>
              <span className="text-surface-600">·</span>
              <span className="text-surface-400 font-mono">{topic.total_votes.toLocaleString()} votes</span>
            </div>
          </div>
        )}

        {/* Signal card */}
        {loading ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-3 gap-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          </div>
        ) : error ? (
          <EmptyState icon={Brain} title="Could not load" description={error} />
        ) : sm && signal ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('rounded-2xl border p-5 space-y-4', signal.bg, signal.border)}
          >
            {/* Signal header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className={cn('flex items-center gap-2 text-lg font-bold', signal.color)}>
                  <SignalIcon className="h-5 w-5" />
                  Smart Money: {signal.label}
                </div>
                <p className="text-sm text-surface-400 mt-1">{signal.sublabel}</p>
              </div>
              <button
                onClick={load}
                aria-label="Refresh smart money data"
                className="flex-shrink-0 p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {/* Smart money vs crowd bars */}
            <div className="space-y-3">
              {/* Smart money bar */}
              <div>
                <div className="flex justify-between text-[11px] font-mono text-surface-400 mb-1.5">
                  <span>SMART MONEY ({sm.total_count} traders)</span>
                  <span>
                    <span className="text-for-300">{sm.for_pct}% FOR</span>
                    {' · '}
                    <span className="text-against-300">{100 - sm.for_pct}% AGN</span>
                  </span>
                </div>
                <div className="h-3 rounded-full bg-surface-300 overflow-hidden flex">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${sm.for_pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="h-full bg-for-500 rounded-l-full"
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${100 - sm.for_pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="h-full bg-against-500 rounded-r-full"
                  />
                </div>
              </div>

              {/* Crowd bar */}
              <div>
                <div className="flex justify-between text-[11px] font-mono text-surface-400 mb-1.5">
                  <span>CROWD ({topic?.total_votes?.toLocaleString()} votes)</span>
                  <span>
                    <span className="text-for-400">{topic?.price}% FOR</span>
                    {' · '}
                    <span className="text-against-400">{100 - (topic?.price ?? 50)}% AGN</span>
                  </span>
                </div>
                <div className="h-3 rounded-full bg-surface-300 overflow-hidden flex">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${topic?.price ?? 50}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                    className="h-full bg-for-700 rounded-l-full"
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${100 - (topic?.price ?? 50)}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                    className="h-full bg-against-700 rounded-r-full"
                  />
                </div>
              </div>
            </div>

            {/* Divergence callout */}
            {sm.signal !== 'aligned' && sm.signal !== 'neutral' && sm.total_count >= 3 && (
              <div className={cn(
                'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm',
                sm.divergence > 0
                  ? 'bg-for-900/30 border border-for-700/40 text-for-300'
                  : 'bg-against-900/30 border border-against-700/40 text-against-300',
              )}>
                {sm.divergence > 0
                  ? <TrendingUp className="h-4 w-4 flex-shrink-0" />
                  : <TrendingDown className="h-4 w-4 flex-shrink-0" />
                }
                <span className="font-mono font-semibold">
                  {Math.abs(sm.divergence)}¢ divergence
                </span>
                <span className="text-surface-400 text-xs">
                  — smart money is {sm.divergence > 0 ? 'more bullish' : 'more bearish'} than the crowd
                </span>
              </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3">
              <MiniStat
                label="Smart Traders"
                value={sm.total_count.toString()}
                sub="qualify"
              />
              <MiniStat
                label="Avg Clout"
                value={formatClout(sm.avg_clout)}
                sub="per trader"
              />
              <MiniStat
                label="Elders"
                value={sm.elder_count.toString()}
                sub={`of ${sm.total_count}`}
              />
            </div>

            {/* Threshold note */}
            <p className="text-[11px] text-surface-600 font-mono text-center">
              Threshold: ≥{formatClout(sm.avg_clout)} clout or role Elder / Troll Catcher
            </p>
          </motion.div>
        ) : null}

        {/* Trader list */}
        {!loading && !error && (
          <div className="space-y-4">
            {/* Tab strip */}
            <div className="flex gap-1.5">
              {([
                { id: 'all',     label: `All (${(data?.all_traders ?? []).length})` },
                { id: 'for',     label: `FOR (${(data?.for_traders ?? []).length})` },
                { id: 'against', label: `AGAINST (${(data?.against_traders ?? []).length})` },
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors',
                    tab === t.id
                      ? t.id === 'for'
                        ? 'bg-for-500/20 text-for-300 border border-for-500/40'
                        : t.id === 'against'
                          ? 'bg-against-500/20 text-against-300 border border-against-500/40'
                          : 'bg-surface-300 text-white border border-surface-400'
                      : 'bg-surface-200 text-surface-500 border border-surface-300 hover:text-white',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Trader rows */}
            <AnimatePresence mode="wait">
              {displayTraders.length === 0 ? (
                <EmptyState
                  key="empty"
                  icon={Brain}
                  title="No smart money here"
                  description="Not enough high-reputation traders have voted on this market yet."
                />
              ) : (
                <motion.div
                  key={tab}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  {displayTraders.map(trader => (
                    <TraderRow key={trader.user_id} trader={trader} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Links */}
        {!loading && !error && (
          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              href={`/exchange/${id}/traders`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-xs text-surface-400 hover:text-white transition-colors"
            >
              <Users className="h-3.5 w-3.5" />
              All Traders
            </Link>
            <Link
              href={`/exchange/${id}/flow`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-xs text-surface-400 hover:text-white transition-colors"
            >
              <BarChart2 className="h-3.5 w-3.5" />
              Volume Flow
            </Link>
            <Link
              href={`/exchange/${id}/conviction`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-xs text-surface-400 hover:text-white transition-colors"
            >
              <Gavel className="h-3.5 w-3.5" />
              Conviction
            </Link>
            <Link
              href="/exchange/smart-money"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-xs text-surface-400 hover:text-white transition-colors"
            >
              <Brain className="h-3.5 w-3.5" />
              All Smart Money
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
