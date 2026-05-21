'use client'

/**
 * /analytics/proposals — Topic Proposal Analytics
 *
 * A dedicated analytics dashboard for topics you have authored on the platform.
 * Shows proposal stats (total proposed, laws made, law rate), category breakdown,
 * monthly activity sparkline, and a filterable list of all your proposals.
 *
 * Distinct from:
 *   /analytics/topics     — analytics about topics you VOTED ON
 *   /analytics/legacy     — permanent record highlights (laws + achievements)
 *   /analytics/arguments  — argument portfolio analytics
 *   /analytics/influence  — composite influence score
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  FileText,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  ProposalsAnalyticsResponse,
  ProposalStat,
  CategoryBreakdown,
  MonthlyProposals,
} from '@/app/api/analytics/proposals/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  proposed: { label: 'Proposed', color: 'text-surface-500',  bg: 'bg-surface-400/10', border: 'border-surface-400/30' },
  active:   { label: 'Active',   color: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30' },
  voting:   { label: 'Voting',   color: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/30' },
  law:      { label: 'LAW',      color: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30' },
  failed:   { label: 'Failed',   color: 'text-against-400',  bg: 'bg-against-500/10',  border: 'border-against-500/30' },
  continued:{ label: 'Continued',color: 'text-for-400',      bg: 'bg-for-500/10',      border: 'border-for-500/30' },
}

// ─── Category colours ─────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-purple',
  Culture:     'text-against-300',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-300',
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  delay = 0,
  href,
}: {
  label: string
  value: number
  sub?: string
  icon: typeof TrendingUp
  color: string
  delay?: number
  href?: string
}) {
  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-1"
    >
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5', color)} />
        <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className={cn('text-2xl font-mono font-bold', color)}>
        <AnimatedNumber value={value} />
      </div>
      {sub && (
        <p className="text-[11px] font-mono text-surface-500">{sub}</p>
      )}
    </motion.div>
  )

  if (href) {
    return <Link href={href}>{inner}</Link>
  }
  return inner
}

// ─── Monthly sparkline (SVG) ──────────────────────────────────────────────────

function MonthlySparkline({ data }: { data: MonthlyProposals[] }) {
  if (data.length < 2) return null

  const WIDTH = 320
  const HEIGHT = 56
  const PAD = 8
  const innerW = WIDTH - PAD * 2
  const innerH = HEIGHT - PAD * 2

  const maxCount = Math.max(...data.map((d) => d.count), 1)

  function x(i: number) {
    return PAD + (i / (data.length - 1)) * innerW
  }
  function y(val: number) {
    return PAD + innerH - (val / maxCount) * innerH
  }

  const totalPath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.count).toFixed(1)}`)
    .join(' ')

  // lawPath not used as a path element — law data shown as dots only

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: WIDTH }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full h-14"
          aria-label="Monthly proposals chart"
        >
          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1].map((frac) => (
            <line
              key={frac}
              x1={PAD}
              y1={PAD + innerH * (1 - frac)}
              x2={PAD + innerW}
              y2={PAD + innerH * (1 - frac)}
              stroke="#3f3f4680"
              strokeWidth={0.5}
              strokeDasharray="4 4"
            />
          ))}

          {/* Total proposals line */}
          <path
            d={totalPath}
            fill="none"
            stroke="#60a5fa"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Law dots */}
          {data.map((d, i) =>
            d.lawCount > 0 ? (
              <circle
                key={i}
                cx={x(i)}
                cy={y(d.lawCount)}
                r={3}
                fill="#c9a84c"
                stroke="#0a0a0f"
                strokeWidth={1}
              />
            ) : null
          )}

          {/* Proposal dots */}
          {data.map((d, i) => (
            <circle
              key={i}
              cx={x(i)}
              cy={y(d.count)}
              r={2.5}
              fill="#60a5fa"
              stroke="#0a0a0f"
              strokeWidth={1}
            />
          ))}
        </svg>

        {/* Month labels */}
        <div className="flex justify-between px-1 mt-1">
          {data.slice(0, Math.min(data.length, 7)).map((d, i) => (
            <span key={i} className="text-[9px] font-mono text-surface-500 truncate">
              {d.month.split(' ')[0]}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Proposal row ─────────────────────────────────────────────────────────────

function ProposalRow({ proposal }: { proposal: ProposalStat }) {
  const status = STATUS_CONFIG[proposal.status] ?? STATUS_CONFIG.proposed
  const forPct = Math.round(proposal.bluePct)
  const againstPct = 100 - forPct

  return (
    <Link
      href={`/topic/${proposal.topicId}`}
      className="flex gap-3 p-4 rounded-xl border border-surface-300/60 bg-surface-100/60 hover:bg-surface-100 hover:border-surface-400/60 transition-colors group"
    >
      {/* Side indicator */}
      <div
        className={cn(
          'flex-shrink-0 w-1 rounded-full self-stretch',
          proposal.status === 'law'
            ? 'bg-gold'
            : proposal.status === 'failed'
            ? 'bg-against-500/60'
            : proposal.status === 'voting'
            ? 'bg-purple/60'
            : 'bg-for-500/40'
        )}
      />

      <div className="flex-1 min-w-0">
        {/* Statement */}
        <p className="text-sm text-white line-clamp-2 mb-2 group-hover:text-for-200 transition-colors">
          {proposal.statement}
        </p>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border',
              status.color,
              status.bg,
              status.border
            )}
          >
            {status.label}
          </span>

          {proposal.category && (
            <span
              className={cn(
                'text-[10px] font-mono',
                CATEGORY_COLORS[proposal.category] ?? 'text-surface-500'
              )}
            >
              {proposal.category}
            </span>
          )}

          <span className="text-[10px] font-mono text-surface-500 flex items-center gap-0.5">
            <Users className="h-2.5 w-2.5" />
            {fmt(proposal.totalVotes)}
          </span>

          {proposal.totalArguments > 0 && (
            <span className="text-[10px] font-mono text-surface-500 flex items-center gap-0.5">
              <MessageSquare className="h-2.5 w-2.5" />
              {proposal.totalArguments}
            </span>
          )}

          <span className="text-[10px] font-mono text-surface-600 ml-auto">
            {relativeTime(proposal.createdAt)}
          </span>
        </div>

        {/* Vote bar */}
        {proposal.totalVotes > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300">
              <div
                className="bg-for-500 transition-all"
                style={{ width: `${forPct}%` }}
              />
              <div
                className="bg-against-500 flex-1 transition-all"
              />
            </div>
            <div className="flex justify-between text-[9px] font-mono text-surface-500">
              <span className="text-for-400">{forPct}% FOR</span>
              <span className="text-against-400">{againstPct}% AGAINST</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 flex items-center self-center">
        <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 transition-colors" />
      </div>
    </Link>
  )
}

// ─── Category bar chart ───────────────────────────────────────────────────────

function CategoryBar({
  category,
  count,
  total,
  lawCount,
  avgVotes,
}: CategoryBreakdown & { total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  const color = CATEGORY_COLORS[category] ?? 'text-surface-500'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className={cn('font-semibold', color)}>{category}</span>
        <div className="flex items-center gap-3 text-surface-500">
          {lawCount > 0 && (
            <span className="text-gold flex items-center gap-0.5">
              <Gavel className="h-2.5 w-2.5" />
              {lawCount} {lawCount === 1 ? 'law' : 'laws'}
            </span>
          )}
          <span>{count} topic{count !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            category === 'Economics' ? 'bg-gold' :
            category === 'Politics' ? 'bg-for-500' :
            category === 'Technology' ? 'bg-purple' :
            category === 'Science' ? 'bg-emerald' :
            category === 'Ethics' ? 'bg-against-400' :
            'bg-surface-500'
          )}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
      <div className="text-[9px] font-mono text-surface-600">
        avg {fmt(avgVotes)} votes
      </div>
    </div>
  )
}

// ─── Highlight card ───────────────────────────────────────────────────────────

function HighlightCard({
  title,
  icon: Icon,
  iconColor,
  proposal,
  subLabel,
  subValue,
}: {
  title: string
  icon: typeof Trophy
  iconColor: string
  proposal: ProposalStat
  subLabel: string
  subValue: number | string
}) {
  const status = STATUS_CONFIG[proposal.status] ?? STATUS_CONFIG.proposed

  return (
    <Link
      href={`/topic/${proposal.topicId}`}
      className="rounded-2xl border border-surface-300 bg-surface-100 p-5 hover:bg-surface-100/80 hover:border-surface-400/60 transition-colors group block"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg border', iconColor.replace('text-', 'bg-').replace('-400', '/15').replace('-500', '/15'), 'border-current/20')}>
          <Icon className={cn('h-3.5 w-3.5', iconColor)} />
        </div>
        <span className="text-[11px] font-mono text-surface-400 uppercase tracking-wider">
          {title}
        </span>
      </div>

      <p className="text-sm text-white line-clamp-2 mb-3 group-hover:text-for-200 transition-colors">
        {proposal.statement}
      </p>

      <div className="flex items-center justify-between">
        <span
          className={cn(
            'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border',
            status.color, status.bg, status.border
          )}
        >
          {status.label}
        </span>
        <span className={cn('text-[11px] font-mono font-semibold', iconColor)}>
          {typeof subValue === 'number' ? fmt(subValue) : subValue} {subLabel}
        </span>
      </div>
    </Link>
  )
}

// ─── Filter pill ──────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'law' | 'active' | 'voting' | 'failed' | 'proposed'

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all',      label: 'All' },
  { id: 'law',      label: 'Laws' },
  { id: 'active',   label: 'Active' },
  { id: 'voting',   label: 'Voting' },
  { id: 'failed',   label: 'Failed' },
  { id: 'proposed', label: 'Pending' },
]

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProposalsAnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<ProposalsAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/proposals')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load proposal analytics')
      const json = await res.json() as ProposalsAnalyticsResponse
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  const filteredProposals = data
    ? statusFilter === 'all'
      ? data.proposals
      : data.proposals.filter((p) => p.status === statusFilter)
    : []

  const visibleProposals = showAll ? filteredProposals : filteredProposals.slice(0, 10)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/analytics"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors flex-shrink-0"
            aria-label="Back to analytics"
          >
            <ArrowLeft className="h-4 w-4 text-surface-600" />
          </Link>
          <div>
            <h1 className="font-mono text-xl font-bold text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-for-400" />
              Proposal Analytics
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Topics you&apos;ve authored — votes received, law conversion, and impact
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-3.5 w-3.5 text-surface-500', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </div>
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
              <Skeleton className="h-4 w-32 mb-4" />
              <Skeleton className="h-14 w-full" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/10 p-6 text-center">
            <p className="text-against-400 font-mono text-sm mb-3">{error}</p>
            <button
              onClick={load}
              className="text-xs font-mono text-surface-400 hover:text-white transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Content */}
        {data && !loading && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {/* Empty state */}
              {data.totalProposed === 0 && (
                <EmptyState
                  icon={FileText}
                  title="No proposals yet"
                  description="Start proposing topics to see your analytics here. Every great debate begins with one idea."
                  action={{ label: 'Propose a topic', href: '/topic/create' }}
                />
              )}

              {data.totalProposed > 0 && (
                <>
                  {/* Hero stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard
                      label="Proposed"
                      value={data.totalProposed}
                      icon={FileText}
                      color="text-for-400"
                      sub="total topics authored"
                      delay={0}
                    />
                    <StatCard
                      label="Laws Made"
                      value={data.totalLaws}
                      icon={Gavel}
                      color="text-gold"
                      sub={`${data.lawRate}% law rate`}
                      delay={0.05}
                    />
                    <StatCard
                      label="Votes Received"
                      value={data.totalVotesReceived}
                      icon={Users}
                      color="text-purple"
                      sub={`avg ${fmt(data.avgVotesPerTopic)} per topic`}
                      delay={0.1}
                    />
                    <StatCard
                      label="Arguments Sparked"
                      value={data.totalArgumentsReceived}
                      icon={MessageSquare}
                      color="text-emerald"
                      sub="across all topics"
                      delay={0.15}
                    />
                  </div>

                  {/* Status breakdown + monthly chart */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Status breakdown */}
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                    >
                      <h2 className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                        Status Breakdown
                      </h2>
                      <div className="space-y-2.5">
                        {[
                          { label: 'Laws', count: data.totalLaws, color: 'bg-gold', textColor: 'text-gold' },
                          { label: 'Active', count: data.totalActive, color: 'bg-emerald', textColor: 'text-emerald' },
                          { label: 'Voting', count: data.totalVoting, color: 'bg-purple', textColor: 'text-purple' },
                          { label: 'Pending', count: data.totalProposed_proposed, color: 'bg-for-500/60', textColor: 'text-for-400' },
                          { label: 'Failed', count: data.totalFailed, color: 'bg-against-500', textColor: 'text-against-400' },
                        ]
                          .filter((s) => s.count > 0)
                          .map((s) => (
                            <div key={s.label} className="flex items-center gap-2">
                              <div className="h-2 rounded-full overflow-hidden flex-1 bg-surface-300">
                                <div
                                  className={cn('h-full rounded-full', s.color)}
                                  style={{
                                    width: `${Math.max(
                                      (s.count / data.totalProposed) * 100,
                                      2
                                    )}%`,
                                  }}
                                />
                              </div>
                              <span className={cn('text-[11px] font-mono font-semibold w-6 text-right', s.textColor)}>
                                {s.count}
                              </span>
                              <span className="text-[11px] font-mono text-surface-500 w-14">
                                {s.label}
                              </span>
                            </div>
                          ))}
                      </div>

                      {/* FOR/AGAINST lean */}
                      {data.totalVotesReceived > 0 && (
                        <div className="mt-4 pt-4 border-t border-surface-300">
                          <p className="text-[10px] font-mono text-surface-500 mb-2 uppercase tracking-wider">
                            Community lean on your proposals
                          </p>
                          <div className="flex h-2.5 rounded-full overflow-hidden bg-surface-300">
                            <div
                              className="bg-for-500 transition-all"
                              style={{ width: `${data.avgBluePct}%` }}
                            />
                            <div className="bg-against-500 flex-1" />
                          </div>
                          <div className="flex justify-between text-[10px] font-mono mt-1">
                            <span className="text-for-400">{data.avgBluePct}% avg FOR</span>
                            <span className="text-against-400">{100 - data.avgBluePct}% avg AGAINST</span>
                          </div>
                        </div>
                      )}
                    </motion.div>

                    {/* Monthly chart */}
                    {data.monthlyActivity.length >= 2 && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                      >
                        <h2 className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">
                          Monthly Proposals
                        </h2>
                        <MonthlySparkline data={data.monthlyActivity} />
                        <div className="flex items-center gap-3 mt-3 text-[10px] font-mono text-surface-500">
                          <span className="flex items-center gap-1">
                            <span className="inline-block h-1.5 w-4 rounded-full bg-for-500" />
                            Proposed
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="inline-block h-2 w-2 rounded-full bg-gold" />
                            Laws
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Highlights */}
                  {(data.topByVotes || data.topByArguments || data.mostContested) && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <h2 className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">
                        Highlights
                      </h2>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {data.topByVotes && (
                          <HighlightCard
                            title="Most Votes"
                            icon={Users}
                            iconColor="text-purple"
                            proposal={data.topByVotes}
                            subLabel="votes"
                            subValue={data.topByVotes.totalVotes}
                          />
                        )}
                        {data.topByArguments && data.topByArguments.topicId !== data.topByVotes?.topicId && (
                          <HighlightCard
                            title="Most Debated"
                            icon={MessageSquare}
                            iconColor="text-emerald"
                            proposal={data.topByArguments}
                            subLabel="arguments"
                            subValue={data.topByArguments.totalArguments}
                          />
                        )}
                        {data.mostContested && (
                          <HighlightCard
                            title="Most Contested"
                            icon={Scale}
                            iconColor="text-against-400"
                            proposal={data.mostContested}
                            subLabel="% FOR"
                            subValue={`${Math.round(data.mostContested.bluePct)}%`}
                          />
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Category breakdown */}
                  {data.categoryBreakdown.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 }}
                      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                    >
                      <h2 className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                        By Category
                      </h2>
                      <div className="space-y-4">
                        {data.categoryBreakdown.map((cat) => (
                          <CategoryBar
                            key={cat.category}
                            {...cat}
                            total={data.totalProposed}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Proposal list */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-xs font-mono text-surface-500 uppercase tracking-wider">
                        All Proposals
                      </h2>
                      <Link
                        href="/topic/create"
                        className="flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
                      >
                        <Sparkles className="h-3 w-3" />
                        New topic
                      </Link>
                    </div>

                    {/* Status filter pills */}
                    <div className="flex gap-1.5 flex-wrap mb-3">
                      {FILTERS.map((f) => {
                        const count =
                          f.id === 'all'
                            ? data.totalProposed
                            : f.id === 'law'
                            ? data.totalLaws
                            : f.id === 'active'
                            ? data.totalActive
                            : f.id === 'voting'
                            ? data.totalVoting
                            : f.id === 'failed'
                            ? data.totalFailed
                            : data.totalProposed_proposed
                        if (f.id !== 'all' && count === 0) return null
                        return (
                          <button
                            key={f.id}
                            onClick={() => {
                              setStatusFilter(f.id)
                              setShowAll(false)
                            }}
                            className={cn(
                              'px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border transition-all',
                              statusFilter === f.id
                                ? 'bg-for-500/20 border-for-500/50 text-for-300'
                                : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-400'
                            )}
                          >
                            {f.label}
                            {count > 0 && (
                              <span className="ml-1 opacity-70">{count}</span>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {filteredProposals.length === 0 ? (
                      <div className="text-center py-8 text-sm font-mono text-surface-500">
                        No proposals with status &ldquo;{statusFilter}&rdquo;
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {visibleProposals.map((proposal) => (
                          <ProposalRow key={proposal.topicId} proposal={proposal} />
                        ))}

                        {filteredProposals.length > 10 && !showAll && (
                          <button
                            onClick={() => setShowAll(true)}
                            className="w-full py-3 text-xs font-mono text-surface-500 hover:text-surface-400 transition-colors border border-surface-300/60 rounded-xl hover:border-surface-400/60 flex items-center justify-center gap-1"
                          >
                            Show all {filteredProposals.length} proposals
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>

                  {/* CTA: propose more */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="rounded-2xl border border-for-500/20 bg-for-500/5 p-5 flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-sm font-mono font-semibold text-white">
                        Ready to shape the debate?
                      </p>
                      <p className="text-xs font-mono text-surface-500 mt-0.5">
                        Every law starts as a single proposal.
                      </p>
                    </div>
                    <Link
                      href="/topic/create"
                      className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-for-600/30 border border-for-500/40 text-for-300 text-xs font-mono font-semibold hover:bg-for-600/50 transition-colors"
                    >
                      Propose a Topic
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </motion.div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
