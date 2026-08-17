'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Gavel,
  RefreshCw,
  Shield,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  LawCensusResponse,
  CensusDimension,
  CensusSegment,
} from '@/app/api/laws/[id]/census/route'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  lawId: string
  lawStatement: string
  category: string | null
  establishedAt: string | null
  blue_pct: number
  total_votes: number
  topicId: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DIMENSION_ICONS: Record<string, typeof Users> = {
  seniority: Users,
  role: Shield,
  clout: Star,
  activity: Zap,
}

const SEGMENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '< 1 month':    { bg: 'bg-emerald/10', text: 'text-emerald',   border: 'border-emerald/30' },
  '1–6 months':   { bg: 'bg-for-500/10', text: 'text-for-400',   border: 'border-for-500/30' },
  '6+ months':    { bg: 'bg-gold/10',    text: 'text-gold',       border: 'border-gold/30'    },
  'Citizen':      { bg: 'bg-surface-300/30', text: 'text-surface-600', border: 'border-surface-400/30' },
  'Debator':      { bg: 'bg-for-500/10', text: 'text-for-400',   border: 'border-for-500/30' },
  'Troll Catcher':{ bg: 'bg-against-500/10', text: 'text-against-400', border: 'border-against-500/30' },
  'Elder':        { bg: 'bg-gold/10',    text: 'text-gold',       border: 'border-gold/30'    },
  'Emerging':     { bg: 'bg-surface-300/30', text: 'text-surface-600', border: 'border-surface-400/30' },
  'Established':  { bg: 'bg-for-500/10', text: 'text-for-400',   border: 'border-for-500/30' },
  'Influential':  { bg: 'bg-purple/10',  text: 'text-purple',     border: 'border-purple/30'  },
  'Luminary':     { bg: 'bg-gold/10',    text: 'text-gold',       border: 'border-gold/30'    },
  'New (< 10)':   { bg: 'bg-surface-300/30', text: 'text-surface-600', border: 'border-surface-400/30' },
  'Active (10–99)':{ bg: 'bg-emerald/10', text: 'text-emerald',   border: 'border-emerald/30' },
  'Veteran (100+)':{ bg: 'bg-gold/10',   text: 'text-gold',       border: 'border-gold/30'    },
}

function defaultColor(label: string) {
  return SEGMENT_COLORS[label] ?? {
    bg: 'bg-surface-300/30',
    text: 'text-surface-500',
    border: 'border-surface-400/30',
  }
}

// ─── Segment bar ─────────────────────────────────────────────────────────────

function SegmentBar({ seg, totalVoters }: { seg: CensusSegment; totalVoters: number }) {
  const color = defaultColor(seg.label)
  const forPct = seg.forPct
  const againstPct = 100 - forPct
  const hasVotes = seg.total > 0
  const widthPct = totalVoters > 0 ? Math.round((seg.total / totalVoters) * 100) : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group"
    >
      <div className="flex items-center gap-3 mb-1.5">
        <span className={cn(
          'text-xs font-mono px-2 py-0.5 rounded-md border flex-shrink-0 min-w-[110px] text-center',
          color.bg, color.text, color.border,
        )}>
          {seg.label}
        </span>
        <div className="flex-1 flex items-center gap-2">
          <div className="flex-1 h-2 bg-surface-300/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-gold/60 rounded-full transition-all duration-500"
              style={{ width: `${widthPct}%` }}
              title={`${widthPct}% of voters`}
            />
          </div>
          <span className="text-[10px] font-mono text-surface-500 w-10 text-right flex-shrink-0">
            {widthPct}%
          </span>
        </div>
        <span className="text-xs font-mono text-surface-400 w-12 text-right flex-shrink-0">
          {seg.total.toLocaleString()}
        </span>
      </div>

      {hasVotes && (
        <div className="ml-[118px] flex gap-1 h-1.5 rounded-full overflow-hidden">
          <div
            className="h-full bg-for-500/70 rounded-l-full transition-all duration-500"
            style={{ width: `${forPct}%` }}
            title={`${forPct}% FOR`}
          />
          <div
            className="h-full bg-against-500/70 rounded-r-full flex-1 transition-all duration-500"
            style={{ width: `${againstPct}%` }}
            title={`${againstPct}% AGAINST`}
          />
        </div>
      )}

      {hasVotes && (
        <div className="ml-[118px] flex justify-between mt-1 px-0.5">
          <span className="text-[9px] font-mono text-for-400">{forPct}% FOR</span>
          <span className="text-[9px] font-mono text-against-400">{againstPct}% AGN</span>
        </div>
      )}
    </motion.div>
  )
}

// ─── Dimension card ───────────────────────────────────────────────────────────

function DimensionCard({
  dim,
  totalVoters,
}: {
  dim: CensusDimension
  totalVoters: number
}) {
  const Icon = DIMENSION_ICONS[dim.dimension] ?? BarChart2
  const activeSegments = dim.segments.filter((s) => s.total > 0)

  return (
    <div className="rounded-2xl border border-surface-300/60 bg-surface-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gold/10 border border-gold/30">
          <Icon className="h-4 w-4 text-gold" />
        </div>
        <h3 className="text-sm font-mono font-semibold text-white">{dim.label}</h3>
        <span className="ml-auto text-[10px] font-mono text-surface-600">
          {activeSegments.length} segment{activeSegments.length !== 1 ? 's' : ''}
        </span>
      </div>

      {activeSegments.length === 0 ? (
        <p className="text-xs font-mono text-surface-600 text-center py-3">No data</p>
      ) : (
        <div className="space-y-3">
          {activeSegments.map((seg) => (
            <SegmentBar key={seg.label} seg={seg} totalVoters={totalVoters} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Signal chip ─────────────────────────────────────────────────────────────

function SignalChip({
  label,
  value,
  side,
}: {
  label: string
  value: number | null
  side: 'for' | 'against' | 'neutral'
}) {
  if (value === null) return null
  const color =
    side === 'for'
      ? 'bg-for-500/10 border-for-500/30 text-for-400'
      : side === 'against'
      ? 'bg-against-500/10 border-against-500/30 text-against-400'
      : 'bg-gold/10 border-gold/30 text-gold'

  return (
    <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-mono', color)}>
      <span className="text-surface-400">{label}</span>
      <span className="font-bold">{value}%</span>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CensusSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-28 rounded-2xl" />
      <div className="grid sm:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LawCensusClient({
  lawId,
  lawStatement,
  category,
  establishedAt,
  blue_pct,
  total_votes,
  topicId,
}: Props) {
  const [data, setData] = useState<LawCensusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch(`/api/laws/${lawId}/census`, { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Failed to load census data')
      } else {
        setData(await res.json())
        setError(null)
      }
    } catch {
      setError('Failed to load census data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [lawId])

  useEffect(() => { load() }, [load])

  const backHref = `/law/${lawId}`
  const forPct = Math.round(blue_pct)
  const establishedYear = establishedAt
    ? new Date(establishedAt).getFullYear()
    : null
  const establishedFmt = establishedAt
    ? new Date(establishedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-4 pb-24 md:pb-12">
        {/* Back link */}
        <div className="mb-4">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to law
          </Link>
        </div>

        {/* Header */}
        <div className="rounded-2xl border border-gold/30 bg-gold/5 p-5 mb-5">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-gold/15 border border-gold/30 flex-shrink-0 mt-0.5">
              <Gavel className="h-5 w-5 text-gold" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant="law">LAW</Badge>
                {category && (
                  <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                    {category}
                  </span>
                )}
                {establishedYear && (
                  <span className="text-[10px] font-mono text-gold/70">
                    Est. {establishedFmt}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-white leading-snug line-clamp-3">
                {lawStatement}
              </p>
            </div>
          </div>

          {/* Vote summary */}
          <div className="mt-4 flex items-center gap-4">
            <div className="flex-1 h-2 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-for-500 transition-all duration-500"
                style={{ width: `${forPct}%` }}
              />
              <div
                className="h-full bg-against-500 flex-1 transition-all duration-500"
              />
            </div>
            <div className="flex items-center gap-3 text-xs font-mono flex-shrink-0">
              <span className="flex items-center gap-1 text-for-400">
                <ThumbsUp className="h-3.5 w-3.5" />
                {forPct}%
              </span>
              <span className="flex items-center gap-1 text-against-400">
                <ThumbsDown className="h-3.5 w-3.5" />
                {100 - forPct}%
              </span>
              <span className="text-surface-500">
                {total_votes.toLocaleString()} votes
              </span>
            </div>
          </div>
        </div>

        {/* Title + refresh */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gold" />
            <h2 className="text-sm font-mono font-semibold text-white">Voter Census</h2>
          </div>
          {!loading && (
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <CensusSkeleton />
        ) : error ? (
          <EmptyState
            icon={Gavel}
            iconColor="text-gold"
            iconBg="bg-gold/10"
            iconBorder="border-gold/30"
            title="Census unavailable"
            description={error}
            action={{ label: 'Back to law', href: backHref }}
          />
        ) : !topicId ? (
          <EmptyState
            icon={Gavel}
            iconColor="text-gold"
            iconBg="bg-gold/10"
            iconBorder="border-gold/30"
            title="No voting data"
            description="This law has no linked debate topic to draw voter data from."
            action={{ label: 'Back to law', href: backHref }}
          />
        ) : data && data.totalVotersWithData === 0 ? (
          <EmptyState
            icon={Users}
            iconColor="text-gold"
            iconBg="bg-gold/10"
            iconBorder="border-gold/30"
            title="No voter profiles found"
            description="We couldn't match voter profiles for this law. Voter data may not be available."
            action={{ label: 'Back to law', href: backHref }}
          />
        ) : data ? (
          <>
            {/* Summary signals */}
            {(data.veteranForPct !== null ||
              data.newcormerForPct !== null ||
              data.elderForPct !== null ||
              data.highCloutForPct !== null) && (
              <div className="mb-5">
                <p className="text-[10px] font-mono text-surface-600 uppercase tracking-wider mb-2">
                  Demographic signals
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.veteranForPct !== null && (
                    <SignalChip
                      label="Veterans FOR"
                      value={data.veteranForPct}
                      side={data.veteranForPct >= 55 ? 'for' : data.veteranForPct <= 45 ? 'against' : 'neutral'}
                    />
                  )}
                  {data.newcormerForPct !== null && (
                    <SignalChip
                      label="Newcomers FOR"
                      value={data.newcormerForPct}
                      side={data.newcormerForPct >= 55 ? 'for' : data.newcormerForPct <= 45 ? 'against' : 'neutral'}
                    />
                  )}
                  {data.elderForPct !== null && (
                    <SignalChip
                      label="Elders FOR"
                      value={data.elderForPct}
                      side={data.elderForPct >= 55 ? 'for' : data.elderForPct <= 45 ? 'against' : 'neutral'}
                    />
                  )}
                  {data.highCloutForPct !== null && (
                    <SignalChip
                      label="Luminaries FOR"
                      value={data.highCloutForPct}
                      side={data.highCloutForPct >= 55 ? 'for' : data.highCloutForPct <= 45 ? 'against' : 'neutral'}
                    />
                  )}
                  {data.viewerVoteSide && (
                    <div className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-mono',
                      data.viewerVoteSide === 'for'
                        ? 'bg-for-500/10 border-for-500/30 text-for-400'
                        : 'bg-against-500/10 border-against-500/30 text-against-400'
                    )}>
                      {data.viewerVoteSide === 'for'
                        ? <ThumbsUp className="h-3.5 w-3.5" />
                        : <ThumbsDown className="h-3.5 w-3.5" />}
                      <span>You voted {data.viewerVoteSide === 'for' ? 'FOR' : 'AGAINST'}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="rounded-xl border border-surface-300/60 bg-surface-100 p-3 text-center">
                <p className="text-lg font-mono font-bold text-white">
                  {data.totalVotersWithData.toLocaleString()}
                </p>
                <p className="text-[10px] font-mono text-surface-600 uppercase tracking-wider mt-0.5">
                  With profile
                </p>
              </div>
              <div className="rounded-xl border border-for-500/30 bg-for-500/5 p-3 text-center">
                <p className="text-lg font-mono font-bold text-for-400">
                  {Math.round((data.totalVotersWithData * forPct) / 100).toLocaleString()}
                </p>
                <p className="text-[10px] font-mono text-surface-600 uppercase tracking-wider mt-0.5">
                  Est. FOR
                </p>
              </div>
              <div className="rounded-xl border border-against-500/30 bg-against-500/5 p-3 text-center">
                <p className="text-lg font-mono font-bold text-against-400">
                  {Math.round((data.totalVotersWithData * (100 - forPct)) / 100).toLocaleString()}
                </p>
                <p className="text-[10px] font-mono text-surface-600 uppercase tracking-wider mt-0.5">
                  Est. AGAINST
                </p>
              </div>
            </div>

            {/* Dimension breakdown */}
            <div className="grid sm:grid-cols-2 gap-4 mb-5">
              {data.dimensions.map((dim) => (
                <DimensionCard
                  key={dim.dimension}
                  dim={dim}
                  totalVoters={data.totalVotersWithData}
                />
              ))}
            </div>

            {/* Legend */}
            <div className="rounded-xl border border-surface-300/40 bg-surface-100/40 px-4 py-3 flex flex-wrap gap-4 text-[10px] font-mono text-surface-600">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-6 rounded-full bg-gold/60" /> Share of voters
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-3 rounded-l-full bg-for-500/70" />
                <span className="inline-block h-2 w-3 rounded-r-full bg-against-500/70" />
                FOR / AGAINST split within segment
              </span>
            </div>

            {/* Link to topic census */}
            {topicId && (
              <div className="mt-4">
                <Link
                  href={`/topic/${topicId}/census`}
                  className="flex items-center justify-between p-4 rounded-xl border border-surface-300/60 bg-surface-100 hover:border-gold/40 hover:bg-gold/5 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 group-hover:border-gold/30 transition-colors">
                      <Trophy className="h-4 w-4 text-surface-500 group-hover:text-gold transition-colors" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">View original debate census</p>
                      <p className="text-[10px] font-mono text-surface-600">
                        See the same breakdown on the source topic
                      </p>
                    </div>
                  </div>
                  <ArrowLeft className="h-4 w-4 text-surface-500 rotate-180 group-hover:text-gold transition-colors" />
                </Link>
              </div>
            )}
          </>
        ) : null}
      </main>
      <BottomNav />
    </div>
  )
}
