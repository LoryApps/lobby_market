'use client'

/**
 * GuestVotePrompt
 *
 * Shown when a logged-out visitor tries to vote on a topic.
 * Converts curiosity into signup with a preview of what their vote would do.
 *
 * Distinct from the login page — this is an inline, bottom-sheet nudge
 * designed to feel like a natural continuation of the voting flow.
 */

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Gavel, Landmark, Scale, ThumbsDown, ThumbsUp, Users, Vote, Zap } from 'lucide-react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { cn } from '@/lib/utils/cn'
import type { VoteSide } from '@/lib/supabase/types'

// ─── Simulated vote bar ───────────────────────────────────────────────────────

function SimulatedBar({
  currentPct,
  pendingSide,
  totalVotes,
}: {
  currentPct: number
  pendingSide: VoteSide
  totalVotes: number
}) {
  const isFor = pendingSide === 'blue'
  const newTotal = totalVotes + 1
  const newForVotes = Math.round((currentPct / 100) * totalVotes) + (isFor ? 1 : 0)
  const newPct = (newForVotes / newTotal) * 100
  const delta = newPct - currentPct

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] font-mono text-surface-500">
        <span>Current split</span>
        <span>Your simulated vote</span>
      </div>

      {/* Current bar */}
      <div>
        <div className="flex items-center justify-between text-[11px] font-mono mb-1">
          <span className="text-for-400">{Math.round(currentPct)}% FOR</span>
          <span className="text-against-400">{Math.round(100 - currentPct)}% AGAINST</span>
        </div>
        <div className="h-2 bg-surface-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-for-500 rounded-full transition-all duration-500"
            style={{ width: `${currentPct}%` }}
          />
        </div>
      </div>

      {/* Simulated bar */}
      <div>
        <div className="flex items-center justify-between text-[11px] font-mono mb-1">
          <span className={cn('font-semibold', isFor ? 'text-for-300' : 'text-for-400')}>
            {Math.round(newPct)}% FOR
          </span>
          <span className="text-surface-400 text-[10px]">
            {delta > 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`} shift
          </span>
          <span className={cn('font-semibold', !isFor ? 'text-against-300' : 'text-against-400')}>
            {Math.round(100 - newPct)}% AGAINST
          </span>
        </div>
        <div className="h-2 bg-surface-300 rounded-full overflow-hidden">
          <motion.div
            className={cn(
              'h-full rounded-full',
              isFor ? 'bg-for-400' : 'bg-against-400'
            )}
            initial={{ width: `${currentPct}%` }}
            animate={{ width: `${newPct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      <p className="text-[10px] text-surface-500 text-center">
        {totalVotes.toLocaleString()} votes cast · your vote would be #{(totalVotes + 1).toLocaleString()}
      </p>
    </div>
  )
}

// ─── Feature pill ─────────────────────────────────────────────────────────────

function FeaturePill({ icon: Icon, text }: { icon: typeof Vote; text: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-200/60 border border-surface-300/60 text-[11px] text-surface-500">
      <Icon className="h-3 w-3 text-surface-400 flex-shrink-0" />
      {text}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface GuestVotePromptProps {
  open: boolean
  onClose: () => void
  topicId: string
  topicStatement: string
  pendingSide: VoteSide | null
  currentPct: number
  totalVotes: number
}

export function GuestVotePrompt({
  open,
  onClose,
  topicId,
  topicStatement,
  pendingSide,
  currentPct,
  totalVotes,
}: GuestVotePromptProps) {
  const isFor = pendingSide === 'blue'
  const returnUrl = `/topic/${topicId}`

  return (
    <BottomSheet open={open} onClose={onClose} title="Your vote counts">
      <div className="px-4 pb-4 space-y-5">

        {/* Voted-for label */}
        {pendingSide && (
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold',
            isFor
              ? 'bg-for-500/15 border border-for-500/30 text-for-300'
              : 'bg-against-500/15 border border-against-500/30 text-against-300'
          )}>
            {isFor ? (
              <ThumbsUp className="h-4 w-4 flex-shrink-0" />
            ) : (
              <ThumbsDown className="h-4 w-4 flex-shrink-0" />
            )}
            <span>You want to vote <strong>{isFor ? 'FOR' : 'AGAINST'}</strong></span>
          </div>
        )}

        {/* Topic statement */}
        <p className="text-sm text-surface-600 leading-snug line-clamp-2">
          &ldquo;{topicStatement}&rdquo;
        </p>

        {/* Simulated bar */}
        {pendingSide && (
          <SimulatedBar
            currentPct={currentPct}
            pendingSide={pendingSide}
            totalVotes={totalVotes}
          />
        )}

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2">
          <FeaturePill icon={Vote} text="Unlimited votes" />
          <FeaturePill icon={Users} text="Join 10,000+ citizens" />
          <FeaturePill icon={Gavel} text="Shape real laws" />
          <FeaturePill icon={Zap} text="Earn clout" />
        </div>

        {/* CTAs */}
        <div className="space-y-2.5 pt-1">
          <Link
            href={`/signup?returnUrl=${encodeURIComponent(returnUrl)}`}
            onClick={onClose}
            className={cn(
              'flex items-center justify-center gap-2 w-full py-3.5 rounded-xl',
              'font-semibold text-sm text-white',
              isFor
                ? 'bg-for-600 hover:bg-for-700'
                : 'bg-against-600 hover:bg-against-700',
              'transition-colors'
            )}
          >
            Create free account
            <ArrowRight className="h-4 w-4" />
          </Link>

          <Link
            href={`/login?returnUrl=${encodeURIComponent(returnUrl)}`}
            onClick={onClose}
            className="flex items-center justify-center w-full py-3 rounded-xl text-sm text-surface-500 hover:text-white border border-surface-300 hover:border-surface-400 transition-colors"
          >
            <Scale className="h-3.5 w-3.5 mr-1.5" />
            Already have an account? Sign in
          </Link>
        </div>

        {/* Platform tagline */}
        <p className="text-[11px] text-surface-500 text-center leading-relaxed">
          <Landmark className="inline h-3 w-3 mr-0.5 -mt-0.5" />
          Lobby Market — where debates become law.
          Free forever, no ads, no algorithms.
        </p>

      </div>
    </BottomSheet>
  )
}
