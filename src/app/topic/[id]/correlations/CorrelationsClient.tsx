'use client'

/**
 * /topic/[id]/correlations — Ideological Correlation Explorer
 *
 * Shows which other debates share voters with this one, and whether those
 * voters chose the same side or opposite sides — revealing hidden ideological
 * structure in the civic landscape.
 *
 * Positive correlation = voters who chose FOR here also chose FOR there.
 * Negative correlation = voters who chose FOR here chose AGAINST there.
 *
 * Distinct from:
 *   /correlations           — platform-wide correlation atlas (all topic pairs)
 *   /topic/[id]/connections — wiki backlinks + debate relationships
 *   /topic/[id]/versus      — FOR vs AGAINST argument comparison
 *   /compare                — side-by-side vote stats for two topics
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart2,
  ExternalLink,
  GitCompare,
  Globe,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { CorrelatedTopic, TopicCorrelationsResponse } from '@/app/api/topics/[id]/correlations/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function strengthLabel(abs: number): string {
  if (abs >= 0.75) return 'Very Strong'
  if (abs >= 0.55) return 'Strong'
  if (abs >= 0.35) return 'Moderate'
  return 'Weak'
}

function strengthColor(abs: number, aligned: boolean): string {
  const intensity = abs >= 0.75 ? '400' : abs >= 0.55 ? '500' : '600'
  return aligned ? `text-for-${intensity}` : `text-against-${intensity}`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
      {/* Section */}
      <div>
        <Skeleton className="h-5 w-32 mb-3" />
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-2/5" />
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Correlation strength bar ─────────────────────────────────────────────────

function CorrelationBar({ correlation }: { correlation: number }) {
  const abs = Math.abs(correlation)
  const isAligned = correlation >= 0
  const pct = Math.round(abs * 100)

  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={cn(
            'h-full rounded-full',
            isAligned
              ? 'bg-gradient-to-r from-for-600 to-for-400'
              : 'bg-gradient-to-r from-against-700 to-against-500',
          )}
        />
      </div>
      <span
        className={cn(
          'text-[11px] font-mono font-semibold w-16 text-right tabular-nums',
          isAligned ? 'text-for-400' : 'text-against-400',
        )}
      >
        {pct}% {isAligned ? 'aligned' : 'opposed'}
      </span>
    </div>
  )
}

// ─── Single correlated topic card ─────────────────────────────────────────────

function CorrelationCard({ item, index }: { item: CorrelatedTopic; index: number }) {
  const isAligned = item.direction === 'aligned'
  const abs = Math.abs(item.correlation)
  const forPct = Math.round(item.blue_pct)
  const againstPct = 100 - forPct
  const catColor = CATEGORY_COLORS[item.category ?? ''] ?? 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.5) }}
    >
      <Link
        href={`/topic/${item.id}`}
        className={cn(
          'group block rounded-2xl border p-4 transition-all',
          isAligned
            ? 'border-for-500/20 bg-for-500/5 hover:border-for-500/40 hover:bg-for-500/8'
            : 'border-against-500/20 bg-against-500/5 hover:border-against-500/40 hover:bg-against-500/8',
        )}
      >
        <div className="flex items-start gap-3">
          {/* Direction indicator */}
          <div
            className={cn(
              'flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl mt-0.5',
              isAligned
                ? 'bg-for-500/15 text-for-400'
                : 'bg-against-500/15 text-against-400',
            )}
          >
            {isAligned ? (
              <ThumbsUp className="h-4 w-4" aria-hidden />
            ) : (
              <ThumbsDown className="h-4 w-4" aria-hidden />
            )}
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-mono text-white leading-snug line-clamp-2 group-hover:text-for-100 transition-colors mb-2">
              {item.statement}
            </p>

            {/* Meta row */}
            <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mb-2">
              <Badge
                variant={STATUS_VARIANT[item.status] ?? 'proposed'}
                className="text-[10px] px-1.5 py-0"
              >
                {STATUS_LABEL[item.status] ?? item.statement}
              </Badge>
              {item.category && (
                <span className={cn('text-[11px] font-mono', catColor)}>
                  {item.category}
                </span>
              )}
              <span
                className={cn(
                  'text-[11px] font-mono font-semibold',
                  strengthColor(abs, isAligned),
                )}
              >
                {strengthLabel(abs)}
              </span>
              <span className="flex items-center gap-0.5 text-[11px] font-mono text-surface-600">
                <Users className="h-3 w-3" aria-hidden />
                {item.shared_voters.toLocaleString()} shared voters
              </span>
            </div>

            {/* Correlation strength bar */}
            <CorrelationBar correlation={item.correlation} />

            {/* Vote split for the correlated topic */}
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-for-400 w-6 text-right tabular-nums">
                {forPct}%
              </span>
              <div className="flex-1 h-1 rounded-full overflow-hidden bg-surface-300 flex">
                <div
                  className="h-full bg-for-500"
                  style={{ width: `${forPct}%` }}
                />
                <div
                  className="h-full bg-against-600"
                  style={{ width: `${againstPct}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-against-400 w-6 tabular-nums">
                {againstPct}%
              </span>
            </div>
          </div>

          <ArrowUpRight
            className="flex-shrink-0 h-4 w-4 text-surface-600 opacity-0 group-hover:opacity-100 group-hover:text-white transition-all mt-1"
            aria-hidden
          />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Section (aligned / opposed) ─────────────────────────────────────────────

function CorrelationSection({
  title,
  items,
  icon: Icon,
  iconClass,
  description,
  startIndex,
}: {
  title: string
  items: CorrelatedTopic[]
  icon: typeof ThumbsUp
  iconClass: string
  description: string
  startIndex: number
}) {
  if (items.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('h-4 w-4', iconClass)} aria-hidden />
        <h2 className="text-sm font-mono font-semibold text-white">{title}</h2>
        <span className="text-xs font-mono text-surface-500 ml-1">
          ({items.length})
        </span>
      </div>
      <p className="text-[11px] font-mono text-surface-500 mb-3 leading-relaxed">
        {description}
      </p>
      <div className="space-y-3">
        {items.map((item, i) => (
          <CorrelationCard key={item.id} item={item} index={startIndex + i} />
        ))}
      </div>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CorrelationsClientProps {
  topicId: string
  topicStatement: string
  topicCategory: string | null
  topicBluePct: number
  topicTotalVotes: number
}

// ─── Page component ───────────────────────────────────────────────────────────

export function CorrelationsClient({
  topicId,
  topicStatement,
  topicCategory,
  topicBluePct,
  topicTotalVotes,
}: CorrelationsClientProps) {
  const router = useRouter()
  const [data, setData] = useState<TopicCorrelationsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const forPct = Math.round(topicBluePct)
  const againstPct = 100 - forPct

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch(`/api/topics/${topicId}/correlations?limit=30`, {
        cache: 'no-store',
      })
      if (res.ok) {
        const json = await res.json()
        setData(json as TopicCorrelationsResponse)
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [topicId])

  useEffect(() => {
    load()
  }, [load])

  const aligned = data?.correlations.filter((c) => c.direction === 'aligned') ?? []
  const opposed = data?.correlations.filter((c) => c.direction === 'opposed') ?? []
  const totalSharedVoters = data?.correlations.reduce((s, c) => s + c.shared_voters, 0) ?? 0
  const strongest = data?.correlations[0] ?? null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-12">
        {/* Back nav */}
        <div className="flex items-center gap-2 mb-5">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <span className="text-surface-600" aria-hidden>·</span>
          <Link
            href={`/topic/${topicId}`}
            className="text-sm font-mono text-surface-500 hover:text-white transition-colors truncate max-w-xs"
          >
            {topicStatement.slice(0, 60)}{topicStatement.length > 60 ? '…' : ''}
          </Link>
        </div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple/10 border border-purple/30">
                <GitCompare className="h-5 w-5 text-purple" aria-hidden />
              </div>
              <div>
                <h1 className="font-mono text-xl font-bold text-white leading-tight">
                  Ideological Correlations
                </h1>
                {topicCategory && (
                  <p className={cn('text-xs font-mono mt-0.5', CATEGORY_COLORS[topicCategory] ?? 'text-surface-500')}>
                    {topicCategory}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              aria-label="Refresh correlations"
              className="flex-shrink-0 p-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-all disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden />
            </button>
          </div>

          {/* Topic statement */}
          <div className="mt-4 rounded-xl bg-surface-100 border border-surface-300 p-4">
            <p className="text-sm font-mono text-surface-400 mb-2 leading-relaxed line-clamp-3">
              {topicStatement}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-mono text-for-400 w-6 text-right tabular-nums">
                {forPct}%
              </span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-surface-300 flex">
                <div className="h-full bg-for-500" style={{ width: `${forPct}%` }} />
                <div className="h-full bg-against-600" style={{ width: `${againstPct}%` }} />
              </div>
              <span className="text-[10px] font-mono text-against-400 w-6 tabular-nums">
                {againstPct}%
              </span>
              <span className="text-[11px] font-mono text-surface-500 ml-1">
                {topicTotalVotes.toLocaleString()} votes
              </span>
            </div>
          </div>
        </motion.div>

        {loading ? (
          <PageSkeleton />
        ) : !data || !data.has_data ? (
          <EmptyState
            icon={GitCompare}
            iconColor="text-purple"
            iconBg="bg-purple/10"
            iconBorder="border-purple/20"
            title="No correlations yet"
            description="This topic needs more shared voters with other debates before correlation patterns emerge. Vote on more topics to help build the map."
            actions={[
              { label: 'Explore All Topics', href: '/topics', variant: 'primary' },
              { label: 'Correlation Atlas', href: '/correlations', variant: 'secondary' },
            ]}
          />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="space-y-8"
          >
            {/* Stats overview */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                  Correlated
                </p>
                <p className="text-2xl font-mono font-bold text-white">
                  {data.correlations.length}
                </p>
                <p className="text-[10px] font-mono text-surface-600 mt-0.5">
                  topic{data.correlations.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                  Aligned
                </p>
                <p className="text-2xl font-mono font-bold text-for-400">
                  {aligned.length}
                </p>
                <p className="text-[10px] font-mono text-surface-600 mt-0.5">
                  same direction
                </p>
              </div>
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                  Opposed
                </p>
                <p className="text-2xl font-mono font-bold text-against-400">
                  {opposed.length}
                </p>
                <p className="text-[10px] font-mono text-surface-600 mt-0.5">
                  flip direction
                </p>
              </div>
            </div>

            {/* Strongest signal callout */}
            {strongest && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.15 }}
                className={cn(
                  'rounded-xl border p-4',
                  strongest.direction === 'aligned'
                    ? 'border-for-500/30 bg-for-500/8'
                    : 'border-against-500/30 bg-against-500/8',
                )}
              >
                <p className={cn(
                  'text-[10px] font-mono uppercase tracking-wider mb-1.5',
                  strongest.direction === 'aligned' ? 'text-for-400' : 'text-against-400',
                )}>
                  Strongest {strongest.direction === 'aligned' ? 'alignment' : 'opposition'}
                </p>
                <p className="text-sm font-mono text-white leading-snug line-clamp-2 mb-2">
                  {strongest.statement}
                </p>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'text-xs font-mono font-semibold',
                    strongest.direction === 'aligned' ? 'text-for-300' : 'text-against-300',
                  )}>
                    {Math.round(Math.abs(strongest.correlation) * 100)}%{' '}
                    {strengthLabel(Math.abs(strongest.correlation)).toLowerCase()}{' '}
                    {strongest.direction}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
                    <Users className="h-3 w-3" aria-hidden />
                    {strongest.shared_voters.toLocaleString()} shared
                  </span>
                  <Link
                    href={`/topic/${strongest.id}`}
                    className="ml-auto flex items-center gap-1 text-[11px] font-mono text-surface-400 hover:text-white transition-colors"
                  >
                    View debate
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </Link>
                </div>
              </motion.div>
            )}

            {/* How to read this */}
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
              <div className="flex items-start gap-2.5">
                <BarChart2 className="h-4 w-4 text-purple flex-shrink-0 mt-0.5" aria-hidden />
                <div>
                  <p className="text-xs font-mono font-semibold text-white mb-1">
                    How to read this
                  </p>
                  <p className="text-[11px] font-mono text-surface-500 leading-relaxed">
                    <span className="text-for-400 font-semibold">Aligned topics</span> share voters who tend to vote the same way on both debates —
                    they reveal ideological bundles. <span className="text-against-400 font-semibold">Opposed topics</span> have voters who split
                    directions, indicating ideological tensions. Strength is based on {totalSharedVoters > 0 ? `${totalSharedVoters.toLocaleString()} shared voter observations` : 'shared voter patterns'}.
                  </p>
                </div>
              </div>
            </div>

            {/* Aligned section */}
            <CorrelationSection
              title="Ideologically Aligned"
              items={aligned}
              icon={ThumbsUp}
              iconClass="text-for-400"
              description="Voters who choose FOR here tend to choose FOR on these topics too — and voters who choose AGAINST here tend to choose AGAINST on these."
              startIndex={0}
            />

            {/* Opposed section */}
            <CorrelationSection
              title="Ideologically Opposed"
              items={opposed}
              icon={ThumbsDown}
              iconClass="text-against-400"
              description="Voters who choose FOR here tend to choose AGAINST on these topics — suggesting a fundamental ideological tension between these debates."
              startIndex={aligned.length}
            />

            {/* Footer links */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-surface-300">
              <Link
                href="/correlations"
                className="flex items-center gap-2 text-sm font-mono text-purple hover:text-purple/80 transition-colors"
              >
                <Globe className="h-4 w-4" aria-hidden />
                Explore the full Correlation Atlas
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
              <Link
                href={`/topic/${topicId}`}
                className="flex items-center gap-2 text-sm font-mono text-surface-400 hover:text-white transition-colors sm:ml-auto"
              >
                <Scale className="h-4 w-4" aria-hidden />
                Back to debate
              </Link>
            </div>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
