'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Crown,
  Mic,
  RefreshCw,
  Scale,
  Shield,
  Star,
  ThumbsDown,
  ThumbsUp,
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
  VerdictCensusResponse,
  VerdictDimension,
  VerdictSegment,
} from '@/app/api/debates/[id]/verdict-census/route'

// ─── Types ─────────────────────────────────────────────────────────────────

interface Props {
  debateId: string
  initialTitle: string | null
}

// ─── Icon mapping ───────────────────────────────────────────────────────────

const DIMENSION_ICONS: Record<string, typeof Users> = {
  seniority: Users,
  role: Shield,
  clout: Star,
  activity: Zap,
}

const SEGMENT_COLORS: Record<string, { bg: string; text: string; border: string; fill: string }> = {
  // seniority
  '< 1 month':      { bg: 'bg-emerald/10',       text: 'text-emerald',       border: 'border-emerald/30',       fill: 'bg-emerald/60' },
  '1–6 months':     { bg: 'bg-for-500/10',       text: 'text-for-400',       border: 'border-for-500/30',       fill: 'bg-for-500/60' },
  '6+ months':      { bg: 'bg-gold/10',          text: 'text-gold',          border: 'border-gold/30',          fill: 'bg-gold/60' },
  // role
  'Citizen':        { bg: 'bg-surface-300/30',   text: 'text-surface-600',   border: 'border-surface-400/30',   fill: 'bg-surface-400/60' },
  'Debator':        { bg: 'bg-for-500/10',       text: 'text-for-400',       border: 'border-for-500/30',       fill: 'bg-for-500/60' },
  'Troll Catcher':  { bg: 'bg-against-500/10',   text: 'text-against-400',   border: 'border-against-500/30',   fill: 'bg-against-500/60' },
  'Elder':          { bg: 'bg-gold/10',          text: 'text-gold',          border: 'border-gold/30',          fill: 'bg-gold/60' },
  // clout
  'Emerging':       { bg: 'bg-surface-300/30',   text: 'text-surface-600',   border: 'border-surface-400/30',   fill: 'bg-surface-400/60' },
  'Established':    { bg: 'bg-for-500/10',       text: 'text-for-400',       border: 'border-for-500/30',       fill: 'bg-for-500/60' },
  'Influential':    { bg: 'bg-purple/10',        text: 'text-purple',        border: 'border-purple/30',        fill: 'bg-purple/60' },
  'Luminary':       { bg: 'bg-gold/10',          text: 'text-gold',          border: 'border-gold/30',          fill: 'bg-gold/60' },
  // activity
  'New (< 10)':     { bg: 'bg-surface-300/30',   text: 'text-surface-600',   border: 'border-surface-400/30',   fill: 'bg-surface-400/60' },
  'Active (10–99)': { bg: 'bg-emerald/10',       text: 'text-emerald',       border: 'border-emerald/30',       fill: 'bg-emerald/60' },
  'Veteran (100+)': { bg: 'bg-gold/10',          text: 'text-gold',          border: 'border-gold/30',          fill: 'bg-gold/60' },
}

function segmentColor(label: string) {
  return SEGMENT_COLORS[label] ?? {
    bg: 'bg-surface-300/30',
    text: 'text-surface-500',
    border: 'border-surface-400/30',
    fill: 'bg-surface-400/60',
  }
}

// ─── Winner pill ────────────────────────────────────────────────────────────

function winnerPillClass(winner: 'blue' | 'red' | 'tie' | null): string {
  if (winner === 'blue') return 'bg-for-500/20 border-for-500/40 text-for-400'
  if (winner === 'red')  return 'bg-against-500/20 border-against-500/40 text-against-400'
  if (winner === 'tie')  return 'bg-surface-300/40 border-surface-400/40 text-surface-500'
  return 'bg-surface-300/30 border-surface-400/30 text-surface-500'
}

function winnerLabel(winner: 'blue' | 'red' | 'tie' | null): string {
  if (winner === 'blue') return 'FOR'
  if (winner === 'red')  return 'AGAINST'
  if (winner === 'tie')  return 'TIE'
  return '—'
}

// ─── Segment bar (blue / tie / red stacked) ────────────────────────────────

function SegmentBar({ seg, totalVoters }: { seg: VerdictSegment; totalVoters: number }) {
  const color = segmentColor(seg.label)
  const hasVotes = seg.total > 0
  const widthPct = totalVoters > 0 ? Math.round((seg.total / totalVoters) * 100) : 0

  // Determine dominant side for this segment
  const dominant: 'blue' | 'red' | 'tie' | null = !hasVotes
    ? null
    : seg.blue > seg.red && seg.blue > seg.tie
    ? 'blue'
    : seg.red > seg.blue && seg.red > seg.tie
    ? 'red'
    : seg.tie > seg.blue && seg.tie > seg.red
    ? 'tie'
    : 'tie'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group"
    >
      <div className="flex items-center gap-3 mb-1.5">
        <span className={cn(
          'text-[10px] font-mono px-2 py-0.5 rounded-md border flex-shrink-0 min-w-[110px] text-center',
          color.bg, color.text, color.border,
        )}>
          {seg.label}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[11px] font-mono text-surface-500 tabular-nums">
              {seg.total.toLocaleString()} voter{seg.total === 1 ? '' : 's'} ({widthPct}%)
            </span>
            {hasVotes && dominant && (
              <span className={cn(
                'ml-auto text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border',
                winnerPillClass(dominant),
              )}>
                {winnerLabel(dominant)} leads
              </span>
            )}
          </div>
          {/* Population bar */}
          <div className="h-1.5 rounded-full bg-surface-300/50 overflow-hidden mb-1">
            <motion.div
              className={cn('h-full rounded-full', color.fill)}
              initial={{ width: 0 }}
              animate={{ width: `${widthPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          {/* BLUE / TIE / RED stacked bar */}
          {hasVotes ? (
            <div className="flex h-2 rounded-full overflow-hidden bg-surface-300/30">
              <motion.div
                className="bg-for-500"
                style={{ width: `${seg.bluePct}%` }}
                initial={{ width: 0 }}
                animate={{ width: `${seg.bluePct}%` }}
                transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
              />
              <motion.div
                className="bg-surface-500"
                style={{ width: `${seg.tiePct}%` }}
                initial={{ width: 0 }}
                animate={{ width: `${seg.tiePct}%` }}
                transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }}
              />
              <motion.div
                className="bg-against-500 flex-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.5 }}
              />
            </div>
          ) : (
            <div className="h-2 rounded-full bg-surface-300/30" />
          )}
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-0.5 min-w-[3.5rem]">
          <span className="text-[10px] font-mono font-bold text-for-400 tabular-nums">
            {hasVotes ? `${seg.bluePct}%` : '–'} <ThumbsUp className="inline h-2.5 w-2.5" />
          </span>
          {seg.tie > 0 && (
            <span className="text-[10px] font-mono font-bold text-surface-500 tabular-nums">
              {seg.tiePct}% <Scale className="inline h-2.5 w-2.5" />
            </span>
          )}
          <span className="text-[10px] font-mono font-bold text-against-400 tabular-nums">
            {hasVotes ? `${seg.redPct}%` : '–'} <ThumbsDown className="inline h-2.5 w-2.5" />
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Dimension card ──────────────────────────────────────────────────────────

function DimensionCard({ dim, totalVoters }: { dim: VerdictDimension; totalVoters: number }) {
  const Icon = DIMENSION_ICONS[dim.dimension] ?? BarChart2
  const hasAny = dim.segments.some((s) => s.total > 0)

  return (
    <div className="bg-surface-100 border border-surface-300/60 rounded-2xl p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="h-7 w-7 rounded-lg bg-surface-200 flex items-center justify-center flex-shrink-0">
          <Icon className="h-3.5 w-3.5 text-surface-500" />
        </div>
        <h3 className="text-sm font-mono font-bold text-white">{dim.label}</h3>
      </div>
      <div className="space-y-3">
        {hasAny ? (
          dim.segments
            .filter((s) => s.total > 0)
            .sort((a, b) => b.total - a.total)
            .map((seg) => (
              <SegmentBar key={seg.label} seg={seg} totalVoters={totalVoters} />
            ))
        ) : (
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
                  <Skeleton className="h-2 w-3/4 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Signal pill (summary insights) ─────────────────────────────────────────

function SignalPill({
  label,
  winner,
  bluePct,
}: {
  label: string
  winner: 'blue' | 'red' | 'tie' | null
  bluePct: number | null
}) {
  const label2 = winnerLabel(winner)
  const cls = winnerPillClass(winner)
  const detail = bluePct !== null && winner !== null
    ? winner === 'blue'
      ? `${bluePct}% FOR`
      : winner === 'red'
      ? `${100 - bluePct}% AGN`
      : `${bluePct}% FOR · ${100 - bluePct}% other`
    : '—'

  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-mono',
      cls,
    )}>
      <span className="opacity-80">{label}</span>
      <span className="font-bold tabular-nums ml-auto">{label2}</span>
      <span className="opacity-60">·</span>
      <span className="tabular-nums opacity-80">{detail}</span>
    </div>
  )
}

// ─── Main client ────────────────────────────────────────────────────────────

export function VerdictCensusClient({ debateId, initialTitle }: Props) {
  const [data, setData] = useState<VerdictCensusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/debates/${debateId}/verdict-census`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load verdict census')
      const json = (await res.json()) as VerdictCensusResponse
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [debateId])

  useEffect(() => {
    load()
  }, [load])

  const displayTitle = data?.debate.title ?? initialTitle ?? 'Debate'
  const topicStatement = data?.debate.topic_statement ?? null
  const category = data?.debate.category ?? null

  // Signal insights
  const signals: Array<{ label: string; winner: 'blue' | 'red' | 'tie' | null; bluePct: number | null }> = []
  if (data) {
    if (data.veteranWinner !== null) {
      signals.push({ label: 'Veterans (6+ mo)', winner: data.veteranWinner, bluePct: data.veteranBluePct })
    }
    if (data.newcomerWinner !== null) {
      signals.push({ label: 'Newcomers (< 1 mo)', winner: data.newcomerWinner, bluePct: data.newcomerBluePct })
    }
    if (data.elderWinner !== null) {
      signals.push({ label: 'Elders', winner: data.elderWinner, bluePct: data.elderBluePct })
    }
    if (data.luminaryWinner !== null) {
      signals.push({ label: 'Luminaries (2000+ clout)', winner: data.luminaryWinner, bluePct: data.luminaryBluePct })
    }
  }

  const poll = data?.poll
  const overallWinner = poll?.winner ?? null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-5 pb-28 md:pb-12 space-y-5">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          <Link
            href={`/debate/${debateId}/verdict`}
            className={cn(
              'flex-shrink-0 mt-0.5 flex items-center justify-center h-9 w-9 rounded-lg',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
            )}
            aria-label="Back to verdict"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="font-mono text-lg font-bold text-white">Verdict Census</h1>
              {category && <Badge variant="category" size="xs">{category}</Badge>}
            </div>
            <p className="text-xs text-surface-500 font-mono leading-relaxed line-clamp-2 mb-1">
              <span className="text-surface-400">{displayTitle}</span>
              {topicStatement && <span className="text-surface-600"> — {topicStatement}</span>}
            </p>
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-surface-500">
              <Mic className="h-2.5 w-2.5" />
              Who declared the winner?
            </div>
          </div>
        </div>

        {/* ── Overall verdict card ─────────────────────────────────────── */}
        {poll && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={cn(
              'rounded-2xl border p-5 relative overflow-hidden',
              overallWinner === 'blue'
                ? 'bg-for-950/40 border-for-800/40'
                : overallWinner === 'red'
                ? 'bg-against-950/40 border-against-800/40'
                : 'bg-surface-200/40 border-surface-300/60',
            )}
          >
            <div
              className={cn(
                'absolute inset-0 opacity-10 blur-3xl pointer-events-none',
                overallWinner === 'blue' ? 'bg-for-500' : overallWinner === 'red' ? 'bg-against-500' : 'bg-surface-400',
              )}
            />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-mono uppercase tracking-widest text-surface-500">
                  Audience verdict
                </span>
                {overallWinner && overallWinner !== 'tie' && (
                  <span className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold',
                    overallWinner === 'blue' ? 'bg-for-500/20 text-for-400' : 'bg-against-500/20 text-against-400',
                  )}>
                    <Crown className="h-2.5 w-2.5" />
                    {overallWinner === 'blue' ? 'FOR wins' : 'AGAINST wins'}
                  </span>
                )}
                {overallWinner === 'tie' && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold bg-surface-300/40 text-surface-500">
                    <Scale className="h-2.5 w-2.5" />
                    Deadlocked
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center rounded-xl bg-for-500/10 border border-for-500/25 py-2.5">
                  <p className="text-[10px] font-mono text-for-400 uppercase tracking-wider mb-0.5">FOR</p>
                  <p className="text-2xl font-mono font-bold text-for-300 tabular-nums">{poll.bluePct}%</p>
                  <p className="text-[10px] font-mono text-surface-600 tabular-nums">{poll.blue} vote{poll.blue === 1 ? '' : 's'}</p>
                </div>
                <div className="text-center rounded-xl bg-surface-300/30 border border-surface-400/30 py-2.5">
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-0.5">TIE</p>
                  <p className="text-2xl font-mono font-bold text-surface-500 tabular-nums">{poll.tiePct}%</p>
                  <p className="text-[10px] font-mono text-surface-600 tabular-nums">{poll.tie} vote{poll.tie === 1 ? '' : 's'}</p>
                </div>
                <div className="text-center rounded-xl bg-against-500/10 border border-against-500/25 py-2.5">
                  <p className="text-[10px] font-mono text-against-400 uppercase tracking-wider mb-0.5">AGAINST</p>
                  <p className="text-2xl font-mono font-bold text-against-300 tabular-nums">{poll.redPct}%</p>
                  <p className="text-[10px] font-mono text-surface-600 tabular-nums">{poll.red} vote{poll.red === 1 ? '' : 's'}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-surface-500">
                <span>{poll.total.toLocaleString()} audience poll vote{poll.total === 1 ? '' : 's'}</span>
                {data?.viewerVote && (
                  <span className={cn(
                    'font-semibold',
                    data.viewerVote === 'blue' && 'text-for-400',
                    data.viewerVote === 'red' && 'text-against-400',
                    data.viewerVote === 'tie' && 'text-surface-500',
                  )}>
                    You voted: {winnerLabel(data.viewerVote)}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Signal pills ────────────────────────────────────────────── */}
        {signals.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {signals.map((s) => (
              <SignalPill key={s.label} label={s.label} winner={s.winner} bluePct={s.bluePct} />
            ))}
          </div>
        )}

        {/* ── Reload ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-mono text-surface-500">
            {data?.totalVotersWithData
              ? `Segmenting ${data.totalVotersWithData.toLocaleString()} identified voter${data.totalVotersWithData === 1 ? '' : 's'}`
              : ''}
          </p>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className={cn(
              'flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-lg',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
              'transition-colors disabled:opacity-50',
            )}
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ── Body ──────────────────────────────────────────────────── */}
        {loading && !data ? (
          <CensusSkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/5 p-6 text-center">
            <p className="text-sm font-mono text-against-300 mb-2">Couldn&apos;t load verdict census</p>
            <p className="text-xs font-mono text-surface-500 mb-4">{error}</p>
            <button
              type="button"
              onClick={load}
              className="text-xs font-mono px-3 py-1.5 rounded-lg bg-against-500/10 border border-against-500/30 text-against-300 hover:bg-against-500/20 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : data && data.poll.total === 0 ? (
          <EmptyState
            icon={Mic}
            title="No audience votes yet"
            description="No one has voted on which side won this debate. Once viewers cast their post-debate polls, their segmentation will appear here."
            action={{
              label: 'Back to verdict',
              href: `/debate/${debateId}/verdict`,
            }}
            size="md"
          />
        ) : data ? (
          <div className="space-y-4">
            {data.dimensions.map((dim) => (
              <DimensionCard key={dim.dimension} dim={dim} totalVoters={data.totalVotersWithData} />
            ))}
          </div>
        ) : null}

        {/* ── Nav footer ─────────────────────────────────────────────── */}
        <div className="pt-2 border-t border-surface-300/40">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/debate/${debateId}/verdict`}
              className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
            >
              ← Verdict summary
            </Link>
            <span className="text-surface-500">·</span>
            <Link
              href={`/debate/${debateId}/audience`}
              className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
            >
              Audience breakdown
            </Link>
            <span className="text-surface-500">·</span>
            <Link
              href={`/debate/${debateId}/sway`}
              className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
            >
              Sway analysis
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
