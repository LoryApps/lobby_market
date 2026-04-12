'use client'

import { Sparkles, Clock, GitBranch } from 'lucide-react'
import type { Topic } from '@/lib/supabase/types'
import { VoteTimer } from '@/components/voting/VoteTimer'
import { cn } from '@/lib/utils/cn'

interface ChainBannerProps {
  topic: Topic
  className?: string
}

type ChainPhase = 'authoring' | 'voting' | 'idle'

function getChainPhase(topic: Topic): ChainPhase {
  if (topic.continuation_vote_ends_at) {
    const voteEnd = new Date(topic.continuation_vote_ends_at).getTime()
    if (voteEnd > Date.now()) return 'voting'
  }
  if (topic.continuation_window_ends_at) {
    const windowEnd = new Date(topic.continuation_window_ends_at).getTime()
    if (windowEnd > Date.now()) return 'authoring'
  }
  return 'idle'
}

export function ChainBanner({ topic, className }: ChainBannerProps) {
  const phase = getChainPhase(topic)
  const chainDepth = topic.chain_depth ?? 0
  const nextDepth = Math.min(chainDepth + 1, 3)

  // 50-59 => "but", 60-66 => "and", using current vote lean
  const bluePct = topic.blue_pct
  const leadingPct = bluePct >= 50 ? bluePct : 100 - bluePct
  const leadingSide = bluePct >= 50 ? 'AGREE' : 'DISAGREE'

  const phaseLabel =
    phase === 'authoring'
      ? 'AUTHORING CONTINUATIONS'
      : phase === 'voting'
        ? 'VOTING ON CONTINUATIONS'
        : 'REFINING'

  const phaseDescription =
    phase === 'authoring'
      ? 'Debators are submitting "...but/and" refinements. Top 5 advance to a plurality vote.'
      : phase === 'voting'
        ? 'Choose the winning continuation. The top vote-getter becomes the next chain link.'
        : 'This topic is in a refinement phase between voting rounds.'

  const timerEndsAt =
    phase === 'voting'
      ? topic.continuation_vote_ends_at
      : phase === 'authoring'
        ? topic.continuation_window_ends_at
        : null

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 via-surface-100 to-surface-100 p-5 glow-gold',
        className
      )}
    >
      {/* Sparkle accent */}
      <div className="absolute -top-6 -right-6 text-gold/10">
        <Sparkles className="h-32 w-32" />
      </div>

      <div className="relative space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/20">
              <GitBranch className="h-4 w-4 text-gold" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gold">
                This topic is being refined
              </p>
              <p className="text-xs font-medium text-surface-500">
                {phaseLabel}
              </p>
            </div>
          </div>

          {/* Chain depth indicator */}
          <div className="flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1">
            <GitBranch className="h-3 w-3 text-gold" />
            <span className="text-xs font-bold tabular-nums text-gold">
              {nextDepth}/3
            </span>
          </div>
        </div>

        {/* Vote result */}
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold text-white tabular-nums">
            {Math.round(leadingPct)}%
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-surface-500">
            {leadingSide}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm leading-snug text-surface-600">
          {phaseDescription}
        </p>

        {/* Timer */}
        {timerEndsAt && (
          <div className="flex items-center gap-2 border-t border-gold/20 pt-3">
            <Clock className="h-4 w-4 text-gold" />
            <span className="text-xs uppercase tracking-wider text-surface-500">
              {phase === 'authoring' ? 'Authoring ends in' : 'Vote ends in'}
            </span>
            <VoteTimer endsAt={timerEndsAt} className="ml-auto text-gold" />
          </div>
        )}
      </div>
    </div>
  )
}
