'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
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
  TopicCensusResponse,
  CensusDimension,
  CensusSegment,
} from '@/app/api/topics/[id]/census/route'

// ─── Types ─────────────────────────────────────────────────────────────────

interface Props {
  topicId: string
  topicStatement: string
  category: string | null
  status?: string
  blue_pct: number
  total_votes: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const DIMENSION_ICONS: Record<string, typeof Users> = {
  seniority: Users,
  role: Shield,
  clout: Star,
  activity: Zap,
}

const SEGMENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  // seniority
  '< 1 month': { bg: 'bg-emerald/10', text: 'text-emerald', border: 'border-emerald/30' },
  '1–6 months': { bg: 'bg-for-500/10', text: 'text-for-400', border: 'border-for-500/30' },
  '6+ months': { bg: 'bg-gold/10', text: 'text-gold', border: 'border-gold/30' },
  // role
  'Citizen': { bg: 'bg-surface-300/30', text: 'text-surface-600', border: 'border-surface-400/30' },
  'Debator': { bg: 'bg-for-500/10', text: 'text-for-400', border: 'border-for-500/30' },
  'Troll Catcher': { bg: 'bg-against-500/10', text: 'text-against-400', border: 'border-against-500/30' },
  'Elder': { bg: 'bg-gold/10', text: 'text-gold', border: 'border-gold/30' },
  // clout
  'Emerging': { bg: 'bg-surface-300/30', text: 'text-surface-600', border: 'border-surface-400/30' },
  'Established': { bg: 'bg-for-500/10', text: 'text-for-400', border: 'border-for-500/30' },
  'Influential': { bg: 'bg-purple/10', text: 'text-purple', border: 'border-purple/30' },
  'Luminary': { bg: 'bg-gold/10', text: 'text-gold', border: 'border-gold/30' },
  // activity
  'New (< 10)': { bg: 'bg-surface-300/30', text: 'text-surface-600', border: 'border-surface-400/30' },
  'Active (10–99)': { bg: 'bg-emerald/10', text: 'text-emerald', border: 'border-emerald/30' },
  'Veteran (100+)': { bg: 'bg-gold/10', text: 'text-gold', border: 'border-gold/30' },
}

function defaultColor(label: string) {
  return SEGMENT_COLORS[label] ?? {
    bg: 'bg-surface-300/30',
    text: 'text-surface-500',
    border: 'border-surface-400/30',
  }
}

// ─── Segment bar ────────────────────────────────────────────────────────────

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
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs font-mono text-surface-500 tabular-nums">
              {seg.total.toLocaleString()} voters ({widthPct}%)
            </span>
          </div>
          {/* Population bar */}
          <div className="h-1.5 rounded-full bg-surface-300/50 overflow-hidden mb-1">
            <motion.div
              className={cn('h-full rounded-full', color.bg.replace('/10', '/60'))}
              initial={{ width: 0 }}
              animate={{ width: `${widthPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          {/* FOR/AGAINST bar */}
          {hasVotes ? (
            <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300/30 gap-px">
              <motion.div
                className="bg-for-500 rounded-l-full"
                style={{ width: `${forPct}%` }}
                initial={{ width: 0 }}
                animate={{ width: `${forPct}%` }}
                transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
              />
              <motion.div
                className="bg-against-500 rounded-r-full flex-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.5 }}
              />
            </div>
          ) : (
            <div className="h-1.5 rounded-full bg-surface-300/30" />
          )}
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
          <span className="text-[10px] font-mono font-bold text-for-400 tabular-nums">
            {hasVotes ? `${forPct}%` : '–'} <ThumbsUp className="inline h-2.5 w-2.5" />
          </span>
          <span className="text-[10px] font-mono font-bold text-against-400 tabular-nums">
            {hasVotes ? `${againstPct}%` : '–'} <ThumbsDown className="inline h-2.5 w-2.5" />
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Dimension card ──────────────────────────────────────────────────────────

function DimensionCard({ dim, totalVoters }: { dim: CensusDimension; totalVoters: number }) {
  const Icon = DIMENSION_ICONS[dim.dimension] ?? BarChart2

  return (
    <div className="bg-surface-100 border border-surface-300/60 rounded-2xl p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="h-7 w-7 rounded-lg bg-surface-200 flex items-center justify-center flex-shrink-0">
          <Icon className="h-3.5 w-3.5 text-surface-500" />
        </div>
        <h3 className="text-sm font-mono font-bold text-white">{dim.label}</h3>
      </div>
      <div className="space-y-3">
        {dim.segments
          .filter((s) => s.total > 0)
          .sort((a, b) => b.total - a.total)
          .map((seg) => (
            <SegmentBar key={seg.label} seg={seg} totalVoters={totalVoters} />
          ))}
        {dim.segments.every((s) => s.total === 0) && (
          <p className="text-xs text-surface-500 font-mono">No data available for this dimension.</p>
        )}
      </div>
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function CensusSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-surface-100 border border-surface-300/60 rounded-2xl p-5">
          <Skeleton className="h-5 w-36 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex items-center gap-3">
                <Skeleton className="h-5 w-28 rounded-md" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-1.5 w-full rounded-full" />
                  <Skeleton className="h-1.5 w-3/4 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Signal pills ─────────────────────────────────────────────────────────────

function SignalPill({
  label,
  pct,
  side,
}: {
  label: string
  pct: number
  side: 'for' | 'against'
}) {
  const isFor = side === 'for'
  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-mono',
      isFor
        ? 'bg-for-500/8 border-for-500/25 text-for-300'
        : 'bg-against-500/8 border-against-500/25 text-against-300',
    )}>
      <span className="text-surface-400">{label}</span>
      <span className="font-bold tabular-nums">{pct}% {isFor ? 'FOR' : 'AGN'}</span>
    </div>
  )
}

// ─── Main client ─────────────────────────────────────────────────────────────

export function CensusClient({
  topicId,
  topicStatement,
  category,
  blue_pct,
  total_votes,
}: Props) {
  const [data, setData] = useState<TopicCensusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/census`)
      if (!res.ok) throw new Error('Failed to load census data')
      const json = await res.json() as TopicCensusResponse
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  const overallForPct = Math.round(blue_pct ?? 50)
  const overallAgainstPct = 100 - overallForPct

  // Signal insights
  const signals: Array<{ label: string; pct: number; side: 'for' | 'against' }> = []
  if (data) {
    if (data.veteranForPct !== null) {
      signals.push({
        label: 'Veterans (6+ months)',
        pct: data.veteranForPct,
        side: data.veteranForPct >= 50 ? 'for' : 'against',
      })
    }
    if (data.newcormerForPct !== null) {
      signals.push({
        label: 'Newcomers (< 1 month)',
        pct: data.newcormerForPct,
        side: data.newcormerForPct >= 50 ? 'for' : 'against',
      })
    }
    if (data.elderForPct !== null) {
      signals.push({
        label: 'Elders',
        pct: data.elderForPct,
        side: data.elderForPct >= 50 ? 'for' : 'against',
      })
    }
    if (data.highCloutForPct !== null) {
      signals.push({
        label: 'Luminary (2000+ clout)',
        pct: data.highCloutForPct,
        side: data.highCloutForPct >= 50 ? 'for' : 'against',
      })
    }
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-5 pb-28 md:pb-12 space-y-5">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          <Link
            href={`/topic/${topicId}`}
            className={cn(
              'flex-shrink-0 mt-0.5 flex items-center justify-center h-9 w-9 rounded-lg',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
            )}
            aria-label="Back to topic"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="font-mono text-lg font-bold text-white">Voter Census</h1>
              {category && (
                <Badge variant="category" size="xs">{category}</Badge>
              )}
            </div>
            <p className="text-xs text-surface-500 font-mono leading-relaxed line-clamp-2">
              {topicStatement}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            className="flex-shrink-0 p-2 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Overall vote bar ─────────────────────────────────────────── */}
        <div className="bg-surface-100 border border-surface-300/60 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
              <span className="text-sm font-mono font-bold text-for-300 tabular-nums">{overallForPct}% FOR</span>
            </div>
            <div className="flex items-center gap-1.5 text-surface-500">
              <Users className="h-3.5 w-3.5" />
              <span className="text-xs font-mono tabular-nums">{total_votes.toLocaleString()} total votes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-mono font-bold text-against-300 tabular-nums">{overallAgainstPct}% AGN</span>
              <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
            </div>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-surface-200 gap-px">
            <div
              className="bg-for-500 rounded-l-full transition-all duration-700"
              style={{ width: `${overallForPct}%` }}
            />
            <div className="bg-against-500 rounded-r-full flex-1" />
          </div>
          {data && (
            <p className="text-[11px] font-mono text-surface-500 mt-2 text-center">
              {data.totalVotersWithData.toLocaleString()} of {total_votes.toLocaleString()} voters have profile data
            </p>
          )}
        </div>

        {/* ── Signal insights ──────────────────────────────────────────── */}
        {signals.length > 0 && (
          <div>
            <h2 className="text-xs font-mono font-bold text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Trophy className="h-3 w-3" /> Key Signals
            </h2>
            <div className="flex flex-wrap gap-2">
              {signals.map((s) => (
                <SignalPill key={s.label} label={s.label} pct={s.pct} side={s.side} />
              ))}
            </div>
          </div>
        )}

        {/* ── Dimension breakdowns ─────────────────────────────────────── */}
        {loading ? (
          <CensusSkeleton />
        ) : error ? (
          <EmptyState
            icon={BarChart2}
            title="Census unavailable"
            description={error}
            action={{ label: 'Retry', onClick: load }}
          />
        ) : data && data.totalVotersWithData === 0 ? (
          <EmptyState
            icon={Users}
            title="No voter data yet"
            description="Not enough voters have profile data to display a census breakdown. Check back after more votes are cast."
          />
        ) : data ? (
          <div className="space-y-4">
            <h2 className="text-xs font-mono font-bold text-surface-500 uppercase tracking-widest flex items-center gap-2">
              <BarChart2 className="h-3 w-3" /> Demographic Breakdown
            </h2>
            {data.dimensions.map((dim) => (
              <DimensionCard
                key={dim.dimension}
                dim={dim}
                totalVoters={data.totalVotersWithData}
              />
            ))}
          </div>
        ) : null}

        {/* ── Navigation ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-2">
          <Link
            href={`/topic/${topicId}/voters`}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white text-xs font-mono font-semibold transition-colors"
          >
            <Users className="h-3.5 w-3.5" />
            Individual Voters
          </Link>
          <Link
            href={`/topic/${topicId}/archetypes`}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white text-xs font-mono font-semibold transition-colors"
          >
            <Shield className="h-3.5 w-3.5" />
            Archetypes
          </Link>
          <Link
            href={`/topic/${topicId}`}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-for-600/20 border border-for-600/30 text-for-400 hover:bg-for-600/30 text-xs font-mono font-semibold transition-colors"
          >
            Back to Debate
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
