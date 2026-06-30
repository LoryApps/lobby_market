'use client'

/**
 * /topic/[id]/inflection — Debate Inflection Points
 *
 * Detects and narrates the 3–5 biggest shifts in community opinion over the
 * lifetime of a topic. Each inflection shows: when it happened, how much the
 * vote percentage changed, how many votes drove the surge, and the top argument
 * published in that same window — the likely catalyst.
 *
 * Distinct from:
 *   /topic/[id]/momentum   — ongoing velocity chart (not event detection)
 *   /topic/[id]/timeline   — manual event list (not opinion-shift triggered)
 *   /topic/[id]/activity   — raw daily volume, not FOR% change
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  Calendar,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { InflectionPoint, InflectionResponse } from '@/app/api/topics/[id]/inflection/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
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

function truncate(text: string, max = 180): string {
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// ─── Mini vote bar ────────────────────────────────────────────────────────────

function VoteBar({ forPct, label }: { forPct: number; label: string }) {
  const againstPct = 100 - forPct
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] font-mono text-surface-500">
        <span className="text-for-400">{forPct}% FOR</span>
        <span className="text-surface-500 font-normal">{label}</span>
        <span className="text-against-400">{againstPct}% AGAINST</span>
      </div>
      <div className="relative h-2 rounded-full overflow-hidden bg-surface-300">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-700 to-for-500 rounded-l-full"
          style={{ width: `${forPct}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-against-600 rounded-r-full"
          style={{ width: `${againstPct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Arrow indicator ──────────────────────────────────────────────────────────

function DeltaBadge({ delta }: { delta: number }) {
  const abs = Math.abs(delta)
  const isFor = delta > 0
  const Icon = isFor ? ArrowUpRight : ArrowDownRight
  const colorClass = isFor
    ? 'bg-for-500/20 text-for-300 border-for-500/40'
    : 'bg-against-500/20 text-against-300 border-against-500/40'

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-mono font-bold',
        colorClass
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {isFor ? '+' : '−'}{abs}pp FOR
    </div>
  )
}

// ─── Inflection card ──────────────────────────────────────────────────────────

interface InflectionCardProps {
  point: InflectionPoint
  index: number
  topicId: string
}

function InflectionCard({ point, index, topicId }: InflectionCardProps) {
  const isFor = point.direction === 'for'
  const borderColor = isFor ? 'border-for-500/30' : 'border-against-500/30'
  const accentColor = isFor ? 'text-for-400' : 'text-against-400'
  const bgAccent = isFor ? 'bg-for-500/10' : 'bg-against-500/10'
  const TrendIcon = isFor ? TrendingUp : TrendingDown
  const SideIcon = isFor ? ThumbsUp : ThumbsDown

  const narrative = isFor
    ? `FOR support surged ${Math.abs(point.delta)} points`
    : `AGAINST support surged ${Math.abs(point.delta)} points`

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.08 }}
      className={cn(
        'rounded-2xl bg-surface-100 border overflow-hidden',
        borderColor
      )}
    >
      {/* Header row */}
      <div className={cn('px-5 py-4 flex items-center gap-3', bgAccent)}>
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold flex-shrink-0',
            isFor
              ? 'bg-for-500/30 text-for-300'
              : 'bg-against-500/30 text-against-300'
          )}
        >
          {ordinal(index + 1).replace(/\d+/, '')}
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{narrative}</p>
          <p className="text-[11px] text-surface-500 flex items-center gap-1 mt-0.5">
            <Calendar className="h-3 w-3" />
            {formatDate(point.date)}
            <span className="mx-1 text-surface-600">·</span>
            <span>{point.votesInWindow.toLocaleString()} votes in window</span>
          </p>
        </div>
        <DeltaBadge delta={point.delta} />
      </div>

      {/* Vote shift visualisation */}
      <div className="px-5 py-4 space-y-3 border-t border-surface-300/60">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-200/60 rounded-xl p-3">
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-1">Before</p>
            <p className="text-2xl font-bold text-white font-mono">{point.forPctBefore}%</p>
            <p className="text-[11px] text-for-400">FOR</p>
          </div>
          <div className={cn('rounded-xl p-3', bgAccent)}>
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-1">After</p>
            <p className={cn('text-2xl font-bold font-mono', accentColor)}>{point.forPctAfter}%</p>
            <p className={cn('text-[11px]', accentColor)}>FOR</p>
          </div>
        </div>

        {/* Arrow bar */}
        <div className="relative">
          <VoteBar forPct={point.forPctBefore} label="before" />
          <div className="flex items-center gap-1.5 my-1.5 ml-1">
            <TrendIcon className={cn('h-4 w-4', accentColor)} />
            <div className="flex-1 h-px border-t border-dashed border-surface-400" />
          </div>
          <VoteBar forPct={point.forPctAfter} label="after" />
        </div>
      </div>

      {/* Top argument in window */}
      {point.topArgument && (
        <div className="px-5 pb-5">
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-2 flex items-center gap-1">
            <Zap className="h-3 w-3" />
            Top argument during this window
          </p>
          <div className="rounded-xl bg-surface-200/50 border border-surface-300/60 p-4">
            <div className="flex items-start gap-2.5 mb-3">
              <Avatar
                src={point.topArgument.avatar_url}
                fallback={point.topArgument.display_name || point.topArgument.username || '?'}
                size="xs"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                  {point.topArgument.display_name || point.topArgument.username || 'Anonymous'}
                </p>
                <p className="text-[10px] text-surface-500">{relativeTime(point.topArgument.created_at)}</p>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <Badge
                  variant={point.topArgument.side === 'for' ? 'for' : 'against'}
                  size="sm"
                >
                  <SideIcon className="h-2.5 w-2.5 mr-1" />
                  {point.topArgument.side === 'for' ? 'FOR' : 'AGAINST'}
                </Badge>
              </div>
            </div>
            <p className="text-sm text-surface-700 leading-relaxed">
              {truncate(point.topArgument.body)}
            </p>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-1 text-[11px] text-surface-500">
                <ThumbsUp className="h-3 w-3" />
                {point.topArgument.upvotes} upvote{point.topArgument.upvotes !== 1 ? 's' : ''}
              </div>
              <Link
                href={`/topic/${topicId}/arguments`}
                className="text-[11px] text-surface-500 hover:text-white flex items-center gap-1 transition-colors"
              >
                View all <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ─── Trend summary banner ─────────────────────────────────────────────────────

function TrendSummary({
  data,
}: {
  data: InflectionResponse
}) {
  const { openingForPct, currentForPct, inflections } = data
  const delta = openingForPct !== null ? currentForPct - openingForPct : 0

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="col-span-2 sm:col-span-1 rounded-xl bg-surface-100 border border-surface-300 p-4">
        <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-1">Opening</p>
        <p className="text-2xl font-bold text-white font-mono">
          {openingForPct !== null ? `${openingForPct}%` : '—'}
        </p>
        <p className="text-[11px] text-for-400">FOR at day 1</p>
      </div>
      <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
        <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-1">Now</p>
        <p className="text-2xl font-bold text-white font-mono">{currentForPct}%</p>
        <p className="text-[11px] text-for-400">FOR today</p>
      </div>
      <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
        <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-1">Net shift</p>
        <p
          className={cn(
            'text-2xl font-bold font-mono',
            delta > 0 ? 'text-for-400' : delta < 0 ? 'text-against-400' : 'text-surface-500'
          )}
        >
          {delta > 0 ? '+' : ''}{delta}pp
        </p>
        <p className="text-[11px] text-surface-500">since day 1</p>
      </div>
      <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
        <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-1">Inflections</p>
        <p className="text-2xl font-bold text-white font-mono">{inflections.length}</p>
        <p className="text-[11px] text-surface-500">detected</p>
      </div>
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export default function InflectionClient() {
  const params = useParams<{ id: string }>()
  const topicId = params.id

  const [data, setData] = useState<InflectionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/inflection`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load inflection data')
      const json: InflectionResponse = await res.json()
      setData(json)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back link */}
        <Link
          href={`/topic/${topicId}`}
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white mb-5 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to topic
        </Link>

        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-5 w-5 text-purple" />
            <h1 className="text-xl font-bold text-white">Debate Inflection Points</h1>
          </div>
          {data && !loading && (
            <p className="text-sm text-surface-500 leading-relaxed line-clamp-2">
              {data.statement}
            </p>
          )}
          {loading && <Skeleton className="h-4 w-3/4 mt-1" />}
        </div>

        {/* ── Loading state ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-7 w-14" />
                    <Skeleton className="h-2 w-12" />
                  </div>
                ))}
              </div>
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                  <div className="px-5 py-4 bg-surface-200/60 flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                  <div className="px-5 py-4 space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      {[0, 1].map((j) => (
                        <div key={j} className="rounded-xl p-3 bg-surface-200/60">
                          <Skeleton className="h-2 w-12 mb-2" />
                          <Skeleton className="h-7 w-12" />
                          <Skeleton className="h-2 w-8 mt-1" />
                        </div>
                      ))}
                    </div>
                    <Skeleton className="h-2 w-full" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                </div>
              ))}
              <div className="flex justify-center pt-2">
                <Loader2 className="h-5 w-5 animate-spin text-surface-500" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Error state ───────────────────────────────────────────────── */}
        {!loading && error && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
            <BarChart2 className="h-10 w-10 text-surface-500 mx-auto mb-3" />
            <p className="text-surface-400 text-sm mb-4">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-white text-sm transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        {/* ── No data state ─────────────────────────────────────────────── */}
        {!loading && !error && data && !data.hasSufficientData && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-surface-100 border border-surface-300 p-10 text-center"
          >
            <Activity className="h-12 w-12 text-surface-600 mx-auto mb-4" />
            <h3 className="text-white font-semibold mb-2">Not enough data yet</h3>
            <p className="text-surface-500 text-sm max-w-xs mx-auto leading-relaxed">
              Inflection detection requires at least 20 votes cast across multiple days.
              Check back as the debate grows.
            </p>
            <Link
              href={`/topic/${topicId}`}
              className="mt-5 inline-flex items-center gap-1.5 text-sm text-surface-400 hover:text-white transition-colors"
            >
              View topic <ChevronRight className="h-4 w-4" />
            </Link>
          </motion.div>
        )}

        {/* ── Main content ──────────────────────────────────────────────── */}
        {!loading && !error && data && data.hasSufficientData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Summary stats */}
            <TrendSummary data={data} />

            {/* Overall trend narrative */}
            <div
              className={cn(
                'rounded-xl border px-4 py-3 flex items-center gap-3 text-sm',
                data.overallTrend === 'for'
                  ? 'bg-for-500/10 border-for-500/30 text-for-300'
                  : data.overallTrend === 'against'
                  ? 'bg-against-500/10 border-against-500/30 text-against-300'
                  : 'bg-surface-200 border-surface-300 text-surface-400'
              )}
            >
              {data.overallTrend === 'for' ? (
                <TrendingUp className="h-4 w-4 flex-shrink-0" />
              ) : data.overallTrend === 'against' ? (
                <TrendingDown className="h-4 w-4 flex-shrink-0" />
              ) : (
                <BarChart2 className="h-4 w-4 flex-shrink-0" />
              )}
              <span>
                {data.overallTrend === 'for'
                  ? `Overall, FOR support has grown since this debate opened — the majority is strengthening.`
                  : data.overallTrend === 'against'
                  ? `Overall, AGAINST support has gained ground since this debate opened — the consensus is eroding.`
                  : `Opinion has remained broadly stable across the lifetime of this debate.`}
              </span>
            </div>

            {/* Inflection point label */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-surface-300" />
              <span className="text-[11px] font-mono text-surface-500 uppercase tracking-widest whitespace-nowrap">
                {data.inflections.length} inflection{data.inflections.length !== 1 ? 's' : ''} detected
              </span>
              <div className="flex-1 h-px bg-surface-300" />
            </div>

            {/* Inflection cards */}
            <div className="space-y-4">
              {data.inflections.map((point, i) => (
                <InflectionCard
                  key={point.date}
                  point={point}
                  index={i}
                  topicId={topicId}
                />
              ))}
            </div>

            {/* Footer nav */}
            <div className="pt-2 flex flex-wrap gap-2">
              <Link
                href={`/topic/${topicId}/momentum`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-xs text-surface-400 hover:text-white transition-colors"
              >
                <Activity className="h-3.5 w-3.5" />
                Momentum
              </Link>
              <Link
                href={`/topic/${topicId}/timeline`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-xs text-surface-400 hover:text-white transition-colors"
              >
                <Calendar className="h-3.5 w-3.5" />
                Timeline
              </Link>
              <Link
                href={`/topic/${topicId}/arguments`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-xs text-surface-400 hover:text-white transition-colors"
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Arguments
              </Link>
              <Link
                href={`/topic/${topicId}/forecast`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-xs text-surface-400 hover:text-white transition-colors"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Forecast
              </Link>
            </div>
          </motion.div>
        )}

        {/* Refresh button */}
        {!loading && !error && data && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 text-xs text-surface-600 hover:text-surface-400 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
