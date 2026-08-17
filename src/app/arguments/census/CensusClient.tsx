'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  FileText,
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
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  ArgumentCensusResponse,
  CensusDimension,
  CensusSegment,
} from '@/app/api/arguments/census/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const DIMENSION_ICONS: Record<string, typeof Users> = {
  role: Shield,
  seniority: Users,
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

// ─── Segment bar ──────────────────────────────────────────────────────────────

function SegmentBar({ seg, totalArgs }: { seg: CensusSegment; totalArgs: number }) {
  const color = defaultColor(seg.label)
  const forPct = seg.forPct
  const againstPct = 100 - forPct
  const hasArgs = seg.total > 0
  const widthPct = totalArgs > 0 ? Math.round((seg.total / totalArgs) * 100) : 0

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
              {seg.total.toLocaleString()} args ({widthPct}%)
            </span>
            {seg.avgUpvotes > 0 && (
              <span className="text-xs font-mono text-gold/70 tabular-nums">
                · {seg.avgUpvotes} avg ↑
              </span>
            )}
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
          {hasArgs ? (
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
            {hasArgs ? `${forPct}%` : '–'} <ThumbsUp className="inline h-2.5 w-2.5" />
          </span>
          <span className="text-[10px] font-mono font-bold text-against-400 tabular-nums">
            {hasArgs ? `${againstPct}%` : '–'} <ThumbsDown className="inline h-2.5 w-2.5" />
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Dimension card ───────────────────────────────────────────────────────────

function DimensionCard({ dim, totalArgs }: { dim: CensusDimension; totalArgs: number }) {
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
            <SegmentBar key={seg.label} seg={seg} totalArgs={totalArgs} />
          ))}
        {dim.segments.every((s) => s.total === 0) && (
          <p className="text-xs text-surface-500 font-mono">No data available for this dimension.</p>
        )}
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

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

// ─── Signal pill ──────────────────────────────────────────────────────────────

function SignalPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-surface-200/50 border-surface-300/60 text-xs font-mono">
      <span className="text-surface-400">{label}</span>
      <span className="font-bold text-white">{value}</span>
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function CensusClient() {
  const [data, setData] = useState<ArgumentCensusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/arguments/census')
      if (!res.ok) throw new Error('Failed to load census data')
      const json = await res.json() as ArgumentCensusResponse
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const overallForPct = data?.overallForPct ?? 50
  const overallAgainstPct = 100 - overallForPct

  const signals: Array<{ label: string; value: string }> = []
  if (data) {
    if (data.mostProductiveRole) {
      signals.push({ label: 'Most productive role', value: data.mostProductiveRole })
    }
    if (data.highestQualityRole) {
      signals.push({ label: 'Highest avg upvotes', value: data.highestQualityRole })
    }
    if (data.veteranForPct !== null) {
      signals.push({ label: 'Veterans lean', value: `${data.veteranForPct}% FOR` })
    }
    if (data.elderForPct !== null) {
      signals.push({ label: 'Elders lean', value: `${data.elderForPct}% FOR` })
    }
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-5 pb-28 md:pb-12 space-y-5">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          <Link
            href="/arguments"
            className={cn(
              'flex-shrink-0 mt-0.5 flex items-center justify-center h-9 w-9 rounded-lg',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
            )}
            aria-label="Back to arguments"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-mono text-lg font-bold text-white mb-1">Argument Writer Census</h1>
            <p className="text-xs text-surface-500 font-mono leading-relaxed">
              Who writes arguments on Lobby Market? Demographic breakdown by role, seniority, clout, and activity.
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

        {/* ── Stats bar ────────────────────────────────────────────────── */}
        <div className="bg-surface-100 border border-surface-300/60 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
              <span className="text-sm font-mono font-bold text-for-300 tabular-nums">
                {overallForPct}% FOR
              </span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1.5 text-surface-500">
                <FileText className="h-3.5 w-3.5" />
                <span className="text-xs font-mono tabular-nums">
                  {(data?.totalArguments ?? 0).toLocaleString()} arguments
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-surface-500">
                <Users className="h-3.5 w-3.5" />
                <span className="text-xs font-mono tabular-nums">
                  {(data?.uniqueAuthors ?? 0).toLocaleString()} authors
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-mono font-bold text-against-300 tabular-nums">
                {overallAgainstPct}% AGN
              </span>
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
        </div>

        {/* ── Signal insights ──────────────────────────────────────────── */}
        {signals.length > 0 && (
          <div>
            <h2 className="text-xs font-mono font-bold text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Trophy className="h-3 w-3" /> Key Signals
            </h2>
            <div className="flex flex-wrap gap-2">
              {signals.map((s) => (
                <SignalPill key={s.label} label={s.label} value={s.value} />
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
        ) : data && data.totalArguments === 0 ? (
          <EmptyState
            icon={FileText}
            title="No argument data yet"
            description="No arguments with profile data found. Check back after more arguments are written."
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
                totalArgs={data.totalArguments}
              />
            ))}
          </div>
        ) : null}

        {/* ── Navigation ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-2">
          <Link
            href="/arguments"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-for-600/20 border border-for-600/30 text-for-400 hover:bg-for-600/30 text-xs font-mono font-semibold transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Browse Arguments
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
