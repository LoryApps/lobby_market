'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Flame,
  Gavel,
  Mic,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CatalystsResponse, Catalyst, CatalystKind } from '@/app/api/exchange/catalysts/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtImpact(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}¢`
}

function fmtImpactPct(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${Math.abs(n).toFixed(1)}%`
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 1) return `${m}m ago`
  return 'just now'
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

const CAT_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-purple',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-400',
}

function catColor(cat: string | null): string {
  return cat && CAT_COLOR[cat] ? CAT_COLOR[cat] : 'text-surface-500'
}

// ─── Catalyst kind config ─────────────────────────────────────────────────────

const KIND_CONFIG: Record<CatalystKind, {
  label: string
  icon: typeof Zap
  iconColor: string
  iconBg: string
  description: string
}> = {
  high_upvote_arg: {
    label: 'Top Argument',
    icon: ThumbsUp,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
    description: 'A highly upvoted argument preceded a price move',
  },
  argument_surge: {
    label: 'Argument Surge',
    icon: Flame,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
    description: 'A burst of arguments drove a consensus shift',
  },
  status_change: {
    label: 'Status Change',
    icon: Gavel,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
    description: 'A status change (proposed → law, etc.) moved the price',
  },
  debate_scheduled: {
    label: 'Debate Event',
    icon: Mic,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
    description: 'A scheduled debate preceded a price move',
  },
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

const KIND_TABS = [
  { id: 'all', label: 'All Catalysts', icon: Sparkles },
  { id: 'high_upvote_arg', label: 'Top Arguments', icon: ThumbsUp },
  { id: 'argument_surge', label: 'Surges', icon: Flame },
  { id: 'status_change', label: 'Status', icon: Gavel },
  { id: 'debate_scheduled', label: 'Debates', icon: Mic },
] as const

const WINDOW_TABS = [
  { id: '24h', label: '24h' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
] as const

// ─── Catalyst card ────────────────────────────────────────────────────────────

function CatalystCard({ catalyst, rank }: { catalyst: Catalyst; rank: number }) {
  const cfg = KIND_CONFIG[catalyst.kind]
  const Icon = cfg.icon
  const isUp = catalyst.price_impact > 0
  const isZero = catalyst.price_impact === 0
  const hasImpact = Math.abs(catalyst.price_impact) >= 0.5

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: rank * 0.03 }}
      className={cn(
        'rounded-2xl border p-4 space-y-3 transition-colors',
        'bg-surface-100 border-surface-300',
        'hover:border-surface-400',
      )}
    >
      {/* ── Header row ── */}
      <div className="flex items-start gap-3">
        {/* Kind icon */}
        <div className={cn(
          'flex-shrink-0 h-9 w-9 rounded-xl flex items-center justify-center',
          cfg.iconBg, 'border border-white/5'
        )}>
          <Icon className={cn('h-4 w-4', cfg.iconColor)} aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Kind label + time */}
          <div className="flex items-center gap-2 mb-0.5">
            <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wider', cfg.iconColor)}>
              {cfg.label}
            </span>
            <span className="text-[10px] text-surface-600">{relTime(catalyst.event_at)}</span>
          </div>

          {/* Topic statement */}
          <Link
            href={`/exchange/${catalyst.topic_id}`}
            className="block text-sm font-medium text-white hover:text-for-400 transition-colors line-clamp-2 leading-snug"
          >
            {catalyst.statement}
          </Link>

          {/* Category + status */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {catalyst.category && (
              <span className={cn('text-xs font-mono', catColor(catalyst.category))}>
                {catalyst.category}
              </span>
            )}
            <Badge
              variant={
                catalyst.status === 'law' ? 'law'
                : catalyst.status === 'failed' ? 'failed'
                : catalyst.status === 'voting' ? 'active'
                : catalyst.status === 'active' ? 'active'
                : 'proposed'
              }
            >
              {catalyst.status === 'status_change' ? catalyst.new_status : catalyst.status}
            </Badge>
          </div>
        </div>

        {/* Price impact */}
        <div className="flex-shrink-0 text-right">
          <div className={cn(
            'text-sm font-mono font-bold',
            isZero ? 'text-surface-500'
            : isUp ? 'text-emerald'
            : 'text-against-400'
          )}>
            {isZero ? '—' : fmtImpact(catalyst.price_impact)}
          </div>
          {hasImpact && (
            <div className={cn(
              'flex items-center gap-0.5 justify-end text-[10px] font-mono',
              isUp ? 'text-emerald' : 'text-against-400'
            )}>
              {isUp
                ? <TrendingUp className="h-2.5 w-2.5" aria-hidden="true" />
                : <TrendingDown className="h-2.5 w-2.5" aria-hidden="true" />
              }
              {fmtImpactPct(catalyst.price_impact_pct)}
            </div>
          )}
          <div className={cn('text-[10px] font-mono mt-0.5', priceColor(catalyst.current_price, catalyst.status))}>
            {catalyst.current_price}¢
          </div>
        </div>
      </div>

      {/* ── Argument content (if applicable) ── */}
      {catalyst.kind === 'high_upvote_arg' && catalyst.argument_text && (
        <div className={cn(
          'rounded-xl p-3 border text-xs text-surface-300 leading-relaxed line-clamp-3',
          catalyst.argument_side === 'blue'
            ? 'bg-for-500/5 border-for-500/20'
            : 'bg-against-500/5 border-against-500/20'
        )}>
          <span className={cn(
            'font-mono font-semibold text-[10px] uppercase mr-1.5',
            catalyst.argument_side === 'blue' ? 'text-for-400' : 'text-against-400'
          )}>
            {catalyst.argument_side === 'blue' ? 'FOR' : 'AGAINST'}
          </span>
          &ldquo;{catalyst.argument_text}{catalyst.argument_text.length >= 200 ? '…' : ''}&rdquo;
        </div>
      )}

      {/* ── Argument author (if applicable) ── */}
      {catalyst.kind === 'high_upvote_arg' && catalyst.argument_author && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar
              src={catalyst.argument_author_avatar ?? null}
              fallback={catalyst.argument_author}
              size="xs"
            />
            <span className="text-xs text-surface-500">
              @{catalyst.argument_author}
            </span>
            {(catalyst.argument_upvotes ?? 0) > 0 && (
              <div className="flex items-center gap-1 text-xs text-for-400">
                <ThumbsUp className="h-2.5 w-2.5" aria-hidden="true" />
                <span>{catalyst.argument_upvotes}</span>
              </div>
            )}
          </div>
          <Link
            href={`/topic/${catalyst.topic_id}`}
            className="text-[10px] font-mono text-surface-600 hover:text-white transition-colors flex items-center gap-0.5"
          >
            View debate
            <ArrowRight className="h-2.5 w-2.5" aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* ── Status change detail ── */}
      {catalyst.kind === 'status_change' && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-surface-500 font-mono capitalize">{catalyst.old_status}</span>
          <ArrowRight className="h-3 w-3 text-surface-600" aria-hidden="true" />
          <span className={cn(
            'font-mono capitalize font-semibold',
            catalyst.new_status === 'law' ? 'text-gold'
            : catalyst.new_status === 'failed' ? 'text-against-400'
            : 'text-for-400'
          )}>
            {catalyst.new_status}
          </span>
          <span className="text-surface-600 ml-auto text-[10px]">Settlement event</span>
        </div>
      )}

      {/* ── Debate detail ── */}
      {catalyst.kind === 'debate_scheduled' && catalyst.debate_id && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-against-400">
            <Mic className="h-3 w-3" aria-hidden="true" />
            <span className="font-mono text-[10px] uppercase tracking-wide">Live debate</span>
          </div>
          <Link
            href={`/debate/${catalyst.debate_id}`}
            className="text-[10px] font-mono text-surface-600 hover:text-white transition-colors flex items-center gap-0.5"
          >
            View debate
            <ArrowRight className="h-2.5 w-2.5" aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* ── Argument surge detail ── */}
      {catalyst.kind === 'argument_surge' && (
        <div className="flex items-center gap-1.5 text-xs text-gold">
          <Flame className="h-3 w-3" aria-hidden="true" />
          <span className="font-mono text-[10px] uppercase tracking-wide">Debate surge drove consensus shift</span>
        </div>
      )}
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CatalystSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <div className="flex-shrink-0 text-right space-y-1">
          <Skeleton className="h-4 w-12 ml-auto" />
          <Skeleton className="h-3 w-10 ml-auto" />
        </div>
      </div>
    </div>
  )
}

// ─── Summary banner ───────────────────────────────────────────────────────────

function SummaryBanner({ summary }: { summary: CatalystsResponse['summary'] }) {
  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
        <div className="text-lg font-mono font-bold text-white">{summary.total_events}</div>
        <div className="text-[10px] text-surface-500 font-mono uppercase tracking-wide mt-0.5">Catalysts</div>
      </div>
      <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
        <div className="text-lg font-mono font-bold text-gold">{summary.avg_price_impact.toFixed(1)}¢</div>
        <div className="text-[10px] text-surface-500 font-mono uppercase tracking-wide mt-0.5">Avg Impact</div>
      </div>
      <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
        <div className={cn(
          'text-lg font-mono font-bold',
          summary.biggest_mover_impact >= 10 ? 'text-emerald' : 'text-for-400'
        )}>
          {summary.biggest_mover_impact.toFixed(1)}¢
        </div>
        <div className="text-[10px] text-surface-500 font-mono uppercase tracking-wide mt-0.5">Biggest Move</div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CatalystsClient() {
  const [data, setData] = useState<CatalystsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeKind, setActiveKind] = useState<string>('all')
  const [activeWindow, setActiveWindow] = useState<string>('7d')

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    try {
      const params = new URLSearchParams()
      if (activeKind !== 'all') params.set('kind', activeKind)
      params.set('window', activeWindow)
      const res = await fetch(`/api/exchange/catalysts?${params}`, { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json() as CatalystsResponse
        setData(json)
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeKind, activeWindow])

  useEffect(() => {
    load()
  }, [load])

  const catalysts = data?.catalysts ?? []
  const isEmpty = !loading && catalysts.length === 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ── */}
        <div className="flex items-start gap-3 mb-6">
          <Link
            href="/exchange"
            className="flex-shrink-0 h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center text-surface-500 hover:text-white hover:bg-surface-300 transition-colors mt-0.5"
            aria-label="Back to Exchange"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <Activity className="h-4 w-4 text-for-400" aria-hidden="true" />
              <h1 className="text-xl font-mono font-bold text-white">Market Catalysts</h1>
              {!loading && data && (
                <span className="text-[10px] font-mono text-surface-600 bg-surface-200 rounded px-1.5 py-0.5 border border-surface-300">
                  LIVE
                </span>
              )}
            </div>
            <p className="text-sm text-surface-500 leading-relaxed">
              Which debates and arguments moved market prices. The signals behind the shifts.
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            aria-label="Refresh catalysts"
            className={cn(
              'flex-shrink-0 h-9 w-9 rounded-xl bg-surface-200 border border-surface-300',
              'flex items-center justify-center text-surface-500',
              'hover:text-white hover:bg-surface-300 transition-colors',
              'disabled:opacity-50'
            )}
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden="true" />
          </button>
        </div>

        {/* ── Window tabs ── */}
        <div className="flex gap-1.5 mb-4">
          {WINDOW_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveWindow(tab.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                activeWindow === tab.id
                  ? 'bg-for-600 border-for-600 text-white'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Kind filter tabs ── */}
        <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
          {KIND_TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveKind(tab.id)}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                  activeKind === tab.id
                    ? 'bg-surface-100 border-surface-400 text-white'
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300'
                )}
              >
                <Icon className="h-3 w-3" aria-hidden="true" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* ── Summary stats ── */}
        {data && !loading && <SummaryBanner summary={data.summary} />}
        {loading && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[0, 1, 2].map(i => (
              <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3">
                <Skeleton className="h-6 w-12 mx-auto mb-1" />
                <Skeleton className="h-2.5 w-16 mx-auto" />
              </div>
            ))}
          </div>
        )}

        {/* ── Explainer callout ── */}
        {!loading && data && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 mb-6">
            <Sparkles className="h-4 w-4 text-for-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-surface-400 leading-relaxed">
              Catalysts are events that correlate with measurable price moves in civic prediction markets.
              Use them to anticipate upcoming swings, or to understand what shaped past consensus shifts.
            </p>
          </div>
        )}

        {/* ── Content ── */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CatalystSkeleton key={i} />
            ))}
          </div>
        )}

        {isEmpty && (
          <EmptyState
            icon={Activity}
            iconColor="text-for-400"
            iconBg="bg-for-500/10"
            iconBorder="border-for-500/20"
            title="No catalysts found"
            description="No market-moving events were detected in this window. Try a longer time range or different filter."
            action={{ label: 'View all markets', href: '/exchange' }}
          />
        )}

        <AnimatePresence mode="wait">
          {!loading && catalysts.length > 0 && (
            <motion.div
              key={`${activeKind}-${activeWindow}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {catalysts.map((catalyst, i) => (
                <CatalystCard key={catalyst.id} catalyst={catalyst} rank={i} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Footer nav ── */}
        {!loading && (
          <div className="mt-8 grid grid-cols-2 gap-3">
            <Link
              href="/exchange/movers"
              className={cn(
                'flex items-center gap-2.5 p-4 rounded-xl',
                'bg-surface-100 border border-surface-300',
                'hover:border-surface-400 transition-colors group'
              )}
            >
              <BarChart2 className="h-4 w-4 text-for-400 flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white group-hover:text-for-400 transition-colors">Movers</p>
                <p className="text-xs text-surface-500">24h price leaders</p>
              </div>
            </Link>
            <Link
              href="/exchange/signals"
              className={cn(
                'flex items-center gap-2.5 p-4 rounded-xl',
                'bg-surface-100 border border-surface-300',
                'hover:border-surface-400 transition-colors group'
              )}
            >
              <Scale className="h-4 w-4 text-purple flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white group-hover:text-purple transition-colors">Signals</p>
                <p className="text-xs text-surface-500">Market intelligence</p>
              </div>
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
