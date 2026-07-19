'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  ChevronRight,
  Flag,
  Globe,
  Minus,
  RefreshCw,
  Scale,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  MarketCoalitionsResponse,
  CoalitionVoteBreakdown,
} from '@/app/api/exchange/[id]/coalitions/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
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

function formatInfluence(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// ─── Stance config ────────────────────────────────────────────────────────────

const STANCE_CONFIG = {
  for: {
    label: 'FOR',
    color: 'text-for-400',
    bg: 'bg-for-500/15',
    border: 'border-for-500/40',
    icon: ThumbsUp,
  },
  against: {
    label: 'AGAINST',
    color: 'text-against-400',
    bg: 'bg-against-500/15',
    border: 'border-against-500/40',
    icon: ThumbsDown,
  },
  neutral: {
    label: 'NEUTRAL',
    color: 'text-surface-400',
    bg: 'bg-surface-300/30',
    border: 'border-surface-400/30',
    icon: Minus,
  },
}

// ─── Summary stat card ────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  color = 'text-white',
  icon: Icon,
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3 text-surface-500" />}
        <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">{label}</span>
      </div>
      <span className={cn('text-2xl font-black font-mono leading-none', color)}>{value}</span>
      {sub && <span className="text-[10px] font-mono text-surface-600 mt-0.5">{sub}</span>}
    </div>
  )
}

// ─── Coalition card ───────────────────────────────────────────────────────────

function CoalitionCard({
  coalition,
  rank,
}: {
  coalition: CoalitionVoteBreakdown
  rank: number
}) {
  const officialStance = coalition.official_stance
  const stanceCfg = officialStance
    ? STANCE_CONFIG[officialStance.stance]
    : null

  const hasVotes = coalition.member_votes_total > 0

  // Alignment color
  const alignment = coalition.alignment_pct
  const alignColor =
    alignment === null ? 'text-surface-500'
    : alignment >= 75 ? 'text-emerald'
    : alignment >= 50 ? 'text-for-400'
    : 'text-against-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04, duration: 0.2 }}
      className="rounded-2xl border border-surface-300 bg-surface-100 p-4 hover:border-surface-400 hover:bg-surface-200 transition-colors"
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Rank */}
        <span className={cn(
          'w-6 text-sm font-mono font-bold shrink-0 mt-0.5',
          rank === 0 ? 'text-gold' : rank === 1 ? 'text-surface-400' : 'text-surface-500'
        )}>
          {rank + 1}
        </span>

        {/* Emoji / badge */}
        <div className="w-9 h-9 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center shrink-0 text-lg">
          {coalition.badge_emoji ?? '🏛️'}
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <Link
            href={`/coalitions/${coalition.id}`}
            className="text-sm font-bold text-white hover:text-for-300 transition-colors truncate block leading-tight"
          >
            {coalition.name}
          </Link>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] font-mono text-surface-500 flex items-center gap-0.5">
              <Users className="w-2.5 h-2.5" />
              {coalition.member_count.toLocaleString()} members
            </span>
            <span className="text-[10px] font-mono text-surface-600 flex items-center gap-0.5">
              <Zap className="w-2.5 h-2.5" />
              {formatInfluence(coalition.coalition_influence)} influence
            </span>
          </div>
        </div>

        {/* Official stance badge */}
        {stanceCfg ? (
          <div className={cn(
            'shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-mono font-bold border',
            stanceCfg.color, stanceCfg.bg, stanceCfg.border,
          )}>
            <stanceCfg.icon className="w-3 h-3" />
            {stanceCfg.label}
          </div>
        ) : (
          <div className="shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-mono font-bold border bg-surface-300/20 text-surface-500 border-surface-400/20">
            <Globe className="w-3 h-3" />
            NO STANCE
          </div>
        )}
      </div>

      {/* Official stance statement */}
      {officialStance?.statement && (
        <div className={cn(
          'mt-3 rounded-xl p-3 border text-xs text-surface-300 italic leading-relaxed',
          stanceCfg?.bg, stanceCfg?.border,
        )}>
          &ldquo;{officialStance.statement}&rdquo;
          {officialStance.declared_by_username && (
            <div className="mt-1.5 not-italic text-[10px] font-mono text-surface-500 flex items-center gap-1">
              <Flag className="w-2.5 h-2.5" />
              Declared by{' '}
              <Link
                href={`/profile/${officialStance.declared_by_username}`}
                className="text-for-400 hover:text-for-300"
              >
                @{officialStance.declared_by_username}
              </Link>
              {' '}· {relTime(officialStance.declared_at)}
            </div>
          )}
        </div>
      )}

      {/* Member vote breakdown */}
      {hasVotes ? (
        <div className="mt-3 space-y-2">
          {/* FOR vs AGAINST bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full overflow-hidden bg-surface-300 flex">
              <div
                className="bg-for-500 h-full rounded-l-full transition-all duration-500"
                style={{ width: `${coalition.for_pct}%` }}
              />
              <div
                className="bg-against-500 h-full rounded-r-full transition-all duration-500"
                style={{ width: `${coalition.against_pct}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-for-400 shrink-0 w-8 text-right">
              {coalition.for_pct}%
            </span>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 text-[10px] font-mono flex-wrap">
            <span className="flex items-center gap-0.5 text-for-400">
              <ThumbsUp className="w-2.5 h-2.5" />
              {coalition.member_votes_for.toLocaleString()} FOR
            </span>
            <span className="flex items-center gap-0.5 text-against-400">
              <ThumbsDown className="w-2.5 h-2.5" />
              {coalition.member_votes_against.toLocaleString()} AGAINST
            </span>
            <span className="text-surface-500">
              {coalition.member_votes_total.toLocaleString()} votes from members
            </span>
            {coalition.participation_rate !== null && (
              <span className="text-surface-600">
                {(coalition.participation_rate * 100).toFixed(1)}% participation
              </span>
            )}
          </div>

          {/* Alignment */}
          {alignment !== null && officialStance && (
            <div className="flex items-center gap-1.5">
              {alignment >= 75 ? (
                <CheckCircle2 className={cn('w-3 h-3', alignColor)} />
              ) : alignment >= 50 ? (
                <Scale className={cn('w-3 h-3', alignColor)} />
              ) : (
                <XCircle className={cn('w-3 h-3', alignColor)} />
              )}
              <span className={cn('text-[10px] font-mono', alignColor)}>
                {alignment}% member alignment with official {officialStance.stance.toUpperCase()} stance
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 text-[10px] font-mono text-surface-600 italic">
          No members have voted on this market yet
        </div>
      )}
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CoalitionsClient({ topicId }: { topicId: string }) {
  const [data, setData] = useState<MarketCoalitionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'for' | 'against' | 'neutral'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exchange/${topicId}/coalitions`)
      if (!res.ok) throw new Error('Failed to load')
      const json: MarketCoalitionsResponse = await res.json()
      setData(json)
    } catch {
      setError('Failed to load coalition data')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  const filtered = data?.coalitions.filter((c) => {
    if (filter === 'all') return true
    if (filter === 'for') return c.official_stance?.stance === 'for'
    if (filter === 'against') return c.official_stance?.stance === 'against'
    if (filter === 'neutral') return c.official_stance?.stance === 'neutral' || !c.official_stance
    return true
  }) ?? []

  const topic = data?.topic
  const summary = data?.summary

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-24 pt-4 space-y-5">

        {/* Back link */}
        <Link
          href={`/exchange/${topicId}`}
          className="inline-flex items-center gap-1.5 text-surface-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to market
        </Link>

        {/* Header */}
        <div>
          <h1 className="text-xl font-black text-white tracking-tight">Coalition Breakdown</h1>
          {topic && (
            <p className="text-sm text-surface-400 mt-1 leading-snug line-clamp-2">
              {topic.statement}
            </p>
          )}
        </div>

        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-surface-300" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-36 bg-surface-300 rounded" />
                    <div className="h-3 w-24 bg-surface-300 rounded" />
                  </div>
                  <div className="h-6 w-16 bg-surface-300 rounded-full" />
                </div>
                <div className="h-2 w-full bg-surface-300 rounded-full" />
                <div className="h-3 w-32 bg-surface-300 rounded" />
              </div>
            ))}
          </div>
        )}

        {error && !loading && (
          <EmptyState
            icon={Shield}
            title="Could not load coalitions"
            description={error}
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {!loading && !error && data && (
          <>
            {/* Market price summary */}
            {topic && (
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">Market Price</p>
                  <p className={cn('text-3xl font-black font-mono', priceColor(topic.price, topic.status))}>
                    {topic.price}¢
                  </p>
                  <p className="text-[10px] font-mono text-surface-500 mt-0.5">
                    {topic.blue_votes.toLocaleString()} FOR · {topic.red_votes.toLocaleString()} AGAINST
                  </p>
                </div>
                <Link
                  href={`/exchange/${topicId}`}
                  className="flex items-center gap-1.5 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
                >
                  View market <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            )}

            {/* Summary grid */}
            {summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SummaryCard
                  label="Coalitions"
                  value={data.coalitions.length}
                  sub="active on this market"
                  icon={Shield}
                />
                <SummaryCard
                  label="Official Stances"
                  value={summary.coalitions_with_stance}
                  sub="positions declared"
                  icon={Flag}
                />
                <SummaryCard
                  label="FOR"
                  value={summary.for_coalitions}
                  sub={summary.heaviest_for ? `led by ${summary.heaviest_for}` : undefined}
                  color="text-for-400"
                  icon={ThumbsUp}
                />
                <SummaryCard
                  label="AGAINST"
                  value={summary.against_coalitions}
                  sub={summary.heaviest_against ? `led by ${summary.heaviest_against}` : undefined}
                  color="text-against-400"
                  icon={ThumbsDown}
                />
              </div>
            )}

            {/* Stance filter tabs */}
            <div className="flex gap-1.5 flex-wrap">
              {(
                [
                  { id: 'all', label: 'All', count: data.coalitions.length },
                  { id: 'for', label: 'FOR', count: summary?.for_coalitions ?? 0 },
                  { id: 'against', label: 'AGAINST', count: summary?.against_coalitions ?? 0 },
                  { id: 'neutral', label: 'No Stance', count: (summary?.neutral_coalitions ?? 0) + (data.coalitions.length - (summary?.coalitions_with_stance ?? 0)) },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={cn(
                    'rounded-full px-3 py-1 text-[11px] font-mono font-bold border transition-colors',
                    filter === tab.id
                      ? tab.id === 'for'
                        ? 'bg-for-500/20 text-for-300 border-for-500/50'
                        : tab.id === 'against'
                        ? 'bg-against-500/20 text-against-300 border-against-500/50'
                        : 'bg-surface-200 text-white border-surface-400'
                      : 'bg-surface-100 text-surface-400 border-surface-300 hover:text-white hover:border-surface-400'
                  )}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className="ml-1 opacity-60">{tab.count}</span>
                  )}
                </button>
              ))}

              {/* Refresh */}
              <button
                onClick={load}
                className="ml-auto rounded-full px-3 py-1 text-[11px] font-mono border bg-surface-100 text-surface-400 border-surface-300 hover:text-white hover:border-surface-400 transition-colors flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </button>
            </div>

            {/* Coalition list */}
            <AnimatePresence mode="popLayout">
              {filtered.length === 0 ? (
                <EmptyState
                  key="empty"
                  icon={Shield}
                  title={filter === 'all' ? 'No coalitions active' : `No ${filter.toUpperCase()} coalitions`}
                  description={
                    filter === 'all'
                      ? 'No public coalitions have members who voted on this market yet.'
                      : `No coalitions have declared a ${filter.toUpperCase()} stance on this market.`
                  }
                />
              ) : (
                <div key="list" className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-surface-500 uppercase tracking-widest">
                      {filtered.length} coalition{filtered.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-[10px] font-mono text-surface-600">
                      sorted by member votes
                    </span>
                  </div>

                  {filtered.map((coalition, i) => (
                    <CoalitionCard
                      key={coalition.id}
                      coalition={coalition}
                      rank={i}
                    />
                  ))}
                </div>
              )}
            </AnimatePresence>

            {/* Link to full coalitions exchange page */}
            <div className="pt-2 flex items-center justify-center gap-4">
              <Link
                href="/exchange/coalitions"
                className="inline-flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
              >
                <Award className="w-3 h-3" />
                All coalition market stats
              </Link>
              <Link
                href={`/topic/${topicId}/coalitions`}
                className="inline-flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
              >
                <Globe className="w-3 h-3" />
                Civic debate view
              </Link>
            </div>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
