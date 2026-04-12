'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import type { VoteSide } from '@/lib/supabase/types'

export interface VoteHistoryEntry {
  id: string
  topic_id: string
  side: VoteSide
  created_at: string
  topic_statement?: string | null
  win_margin?: number | null
}

interface VoteHistoryTimelineProps {
  votes: VoteHistoryEntry[]
  className?: string
}

function dotSize(margin: number | null | undefined): string {
  if (margin == null) return 'h-3 w-3'
  const absolute = Math.abs(margin)
  if (absolute >= 40) return 'h-5 w-5'
  if (absolute >= 20) return 'h-4 w-4'
  return 'h-3 w-3'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function VoteHistoryTimeline({
  votes,
  className,
}: VoteHistoryTimelineProps) {
  if (votes.length === 0) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-surface-300 bg-surface-100 p-6 text-center',
          className
        )}
      >
        <div className="text-sm font-mono text-surface-500">
          No vote history yet.
        </div>
      </div>
    )
  }

  // Reverse so that most recent votes appear on the right
  const ordered = [...votes].reverse()

  return (
    <div
      className={cn(
        'rounded-2xl border border-surface-300 bg-surface-100 p-5',
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
            Vote history
          </div>
          <div className="text-sm font-mono text-surface-700">
            {votes.length} most recent
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-surface-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-for-500" /> For
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-against-500" />{' '}
            Against
          </span>
        </div>
      </div>

      <div className="relative overflow-x-auto pb-3">
        <div className="relative h-16 flex items-center">
          {/* Baseline */}
          <div className="absolute inset-x-0 top-1/2 h-px bg-surface-300 -translate-y-1/2" />

          <div className="relative flex items-center gap-2 min-w-full px-1">
            {ordered.map((vote, idx) => {
              const color =
                vote.side === 'blue' ? 'bg-for-500' : 'bg-against-500'
              const hover =
                vote.side === 'blue'
                  ? 'hover:ring-for-400/60'
                  : 'hover:ring-against-400/60'
              const size = dotSize(vote.win_margin)

              return (
                <motion.div
                  key={vote.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.01 }}
                  className="group relative flex flex-col items-center"
                >
                  <Link
                    href={`/topic/${vote.topic_id}`}
                    aria-label={`Voted ${vote.side === 'blue' ? 'for' : 'against'} on ${vote.topic_statement ?? 'topic'}`}
                    className={cn(
                      'block rounded-full ring-2 ring-transparent transition',
                      color,
                      hover,
                      size
                    )}
                  />
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition pointer-events-none z-10 whitespace-nowrap rounded-md bg-surface-200 border border-surface-300 px-2 py-1 text-[10px] font-mono text-surface-700">
                    {formatDate(vote.created_at)}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
