'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  ChevronRight,
  Clock,
  Flame,
  Gavel,
  MessageSquare,
  Mic,
  Star,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { ScorecardResponse, ScorecardCriterion } from '@/app/api/debates/[id]/scorecard/route'

interface Props {
  debateId: string
}

const CRITERION_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  volume: MessageSquare,
  impact: ThumbsUp,
  quality: Star,
  best: Flame,
  sway: Users,
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  scheduled: 'proposed',
  live: 'active',
  ended: 'law',
  cancelled: 'failed',
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  live: 'Live',
  ended: 'Ended',
  cancelled: 'Cancelled',
}

function ScoreBar({ bluePts, redPts, maxPts }: { bluePts: number; redPts: number; maxPts: number }) {
  const bluePct = maxPts > 0 ? (bluePts / maxPts) * 100 : 0
  const redPct = maxPts > 0 ? (redPts / maxPts) * 100 : 0
  return (
    <div className="flex gap-1 items-center h-2">
      <div className="flex-1 flex justify-end">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${bluePct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-2 rounded-full bg-for-500"
        />
      </div>
      <div className="w-px h-3 bg-surface-400/50 flex-shrink-0" />
      <div className="flex-1">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${redPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-2 rounded-full bg-against-500"
        />
      </div>
    </div>
  )
}

function CriterionRow({ criterion, index }: { criterion: ScorecardCriterion; index: number }) {
  const Icon = CRITERION_ICON[criterion.id] ?? Zap
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.07 }}
      className="rounded-xl bg-surface-100/60 border border-surface-300/40 p-3 md:p-4"
    >
      <div className="flex items-center gap-2 mb-2.5">
        <div className="flex items-center justify-center h-6 w-6 rounded-md bg-surface-200/60">
          <Icon className="h-3.5 w-3.5 text-surface-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">{criterion.label}</p>
          <p className="text-[10px] text-surface-600 leading-tight">{criterion.description}</p>
        </div>
        {criterion.winner !== 'tie' && (
          <span
            className={cn(
              'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border',
              criterion.winner === 'blue'
                ? 'text-for-300 border-for-500/30 bg-for-500/10'
                : 'text-against-300 border-against-500/30 bg-against-500/10',
            )}
          >
            {criterion.winner === 'blue' ? 'FOR' : 'AGAINST'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="text-right">
          <span className="text-lg font-mono font-bold text-for-400">{criterion.blue_pts}</span>
          <span className="text-[10px] text-surface-600 ml-1">pts</span>
        </div>
        <div className="text-center">
          <span className="text-[10px] font-mono text-surface-600">/{criterion.max_pts}</span>
        </div>
        <div className="text-left">
          <span className="text-lg font-mono font-bold text-against-400">{criterion.red_pts}</span>
          <span className="text-[10px] text-surface-600 ml-1">pts</span>
        </div>
      </div>

      <div className="mt-2">
        <ScoreBar bluePts={criterion.blue_pts} redPts={criterion.red_pts} maxPts={criterion.max_pts} />
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-1 text-[10px] font-mono text-surface-600">
        <span className="text-right pr-2">
          {typeof criterion.blue_raw === 'number' && !Number.isInteger(criterion.blue_raw)
            ? criterion.blue_raw.toFixed(1)
            : criterion.blue_raw}
        </span>
        <span className="pl-2">
          {typeof criterion.red_raw === 'number' && !Number.isInteger(criterion.red_raw)
            ? criterion.red_raw.toFixed(1)
            : criterion.red_raw}
        </span>
      </div>
    </motion.div>
  )
}

export function ScorecardClient({ debateId }: Props) {
  const [data, setData] = useState<ScorecardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/debates/${debateId}/scorecard`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error)
        setData(json)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [debateId])

  const winnerLabel =
    data?.overall_winner === 'blue'
      ? 'FOR wins'
      : data?.overall_winner === 'red'
      ? 'AGAINST wins'
      : data?.overall_winner === 'tie'
      ? 'Tie'
      : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12 space-y-5">
        <Link
          href={`/debate/${debateId}/explore`}
          className="inline-flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Debate Hub
        </Link>

        {/* Header */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Award className="h-4 w-4 text-gold" />
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-gold">
              Official Scorecard
            </span>
          </div>

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : error ? (
            <p className="text-sm text-against-400">{error}</p>
          ) : data ? (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant={STATUS_BADGE[data.debate.status] ?? 'proposed'} size="sm">
                  {STATUS_LABEL[data.debate.status] ?? data.debate.status}
                </Badge>
                {data.debate.topic_category && (
                  <span className="text-xs font-mono text-surface-500 px-2 py-0.5 rounded-md bg-surface-200 border border-surface-300">
                    {data.debate.topic_category}
                  </span>
                )}
              </div>
              <h1 className="text-lg md:text-xl font-mono font-bold text-white leading-snug">
                {data.debate.title}
              </h1>
              {data.debate.topic_statement && (
                <p className="text-xs text-surface-500 mt-1 leading-snug line-clamp-2">
                  {data.debate.topic_statement}
                </p>
              )}
              {data.debate.ended_at && (
                <p className="text-[11px] font-mono text-surface-600 flex items-center gap-1.5 mt-2">
                  <Clock className="h-3 w-3" />
                  {new Date(data.debate.ended_at).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              )}
            </>
          ) : null}
        </div>

        {/* Speakers */}
        {data && (data.blue_speaker || data.red_speaker) && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { speaker: data.blue_speaker, side: 'blue' as const, label: 'FOR', total: data.blue_total },
              { speaker: data.red_speaker, side: 'red' as const, label: 'AGAINST', total: data.red_total },
            ].map(({ speaker, side, label, total }) => (
              <motion.div
                key={side}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  'rounded-xl border p-3 text-center',
                  side === 'blue'
                    ? 'bg-for-500/5 border-for-500/20'
                    : 'bg-against-500/5 border-against-500/20',
                )}
              >
                <div className="flex justify-center mb-2">
                  {speaker?.avatar_url ? (
                    <Avatar src={speaker.avatar_url} alt={speaker.display_name ?? speaker.username} size="md" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-surface-200 flex items-center justify-center">
                      <Mic className="h-5 w-5 text-surface-500" />
                    </div>
                  )}
                </div>
                <p
                  className={cn(
                    'text-[10px] font-mono font-bold uppercase tracking-widest mb-0.5',
                    side === 'blue' ? 'text-for-400' : 'text-against-400',
                  )}
                >
                  {label}
                </p>
                <p className="text-xs font-semibold text-white truncate">
                  {speaker ? (speaker.display_name ?? speaker.username) : '—'}
                </p>
                <p
                  className={cn(
                    'text-2xl font-mono font-black mt-2',
                    side === 'blue' ? 'text-for-300' : 'text-against-300',
                  )}
                >
                  {total}
                </p>
                <p className="text-[10px] text-surface-600">of {data.max_total} pts</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Overall winner banner */}
        {data && data.overall_winner !== 'undecided' && winnerLabel && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className={cn(
              'rounded-xl border p-4 flex items-center gap-3',
              data.overall_winner === 'blue'
                ? 'bg-for-500/10 border-for-500/30'
                : data.overall_winner === 'red'
                ? 'bg-against-500/10 border-against-500/30'
                : 'bg-gold/10 border-gold/30',
            )}
          >
            <Trophy
              className={cn(
                'h-5 w-5 flex-shrink-0',
                data.overall_winner === 'blue'
                  ? 'text-for-400'
                  : data.overall_winner === 'red'
                  ? 'text-against-400'
                  : 'text-gold',
              )}
            />
            <div>
              <p className="text-xs font-mono font-bold text-white">{winnerLabel}</p>
              <p className="text-[11px] text-surface-500">
                {data.blue_total} — {data.red_total} on {data.max_total} total points
              </p>
            </div>
          </motion.div>
        )}

        {/* Criteria */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : data ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[11px] font-mono font-bold uppercase tracking-widest text-surface-500">
                Judging Criteria
              </h2>
              <div className="grid grid-cols-2 gap-6 text-[10px] font-mono text-surface-600">
                <span className="text-right text-for-500">FOR</span>
                <span className="text-against-500">AGAINST</span>
              </div>
            </div>
            {data.criteria.map((criterion, i) => (
              <CriterionRow key={criterion.id} criterion={criterion} index={i} />
            ))}
          </div>
        ) : null}

        {/* Viewer count */}
        {data && data.debate.viewer_count > 0 && (
          <p className="text-center text-[11px] font-mono text-surface-600">
            {data.debate.viewer_count.toLocaleString()} viewers attended this debate
          </p>
        )}

        {/* Navigation */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
          <Link
            href={`/debate/${debateId}/verdict`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-gold transition-colors"
          >
            <Gavel className="h-3 w-3" />
            Verdict
            <ChevronRight className="h-3 w-3" />
          </Link>
          <Link
            href={`/debate/${debateId}/performance`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
          >
            <Zap className="h-3 w-3" />
            Performance Stats
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
