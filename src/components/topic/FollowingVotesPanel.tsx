'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Users } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { FollowingVoter, FollowingVotesResponse } from '@/app/api/topics/[id]/following-votes/route'

interface FollowingVotesPanelProps {
  topicId: string
  className?: string
}

const MAX_AVATARS_COLLAPSED = 6

export function FollowingVotesPanel({ topicId, className }: FollowingVotesPanelProps) {
  const [data, setData] = useState<FollowingVotesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/topics/${topicId}/following-votes`)
        if (!res.ok) return
        const json = (await res.json()) as FollowingVotesResponse
        if (!cancelled) setData(json)
      } catch {
        // network error — silently skip
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [topicId])

  // Loading skeleton
  if (loading) {
    return (
      <div className={cn('rounded-xl border border-surface-300 bg-surface-100 p-4', className)}>
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-3 w-32 rounded" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-8 rounded-full" />
          ))}
        </div>
      </div>
    )
  }

  // Nothing to show — not following anyone or no votes
  if (!data || data.total === 0) return null

  const forVoters = data.voters.filter((v) => v.side === 'blue')
  const againstVoters = data.voters.filter((v) => v.side === 'red')

  // Interleave for/against for the collapsed avatar strip so both sides show
  const interleaved: FollowingVoter[] = []
  let fi = 0
  let ai = 0
  while (interleaved.length < MAX_AVATARS_COLLAPSED && (fi < forVoters.length || ai < againstVoters.length)) {
    if (fi < forVoters.length) interleaved.push(forVoters[fi++])
    if (interleaved.length < MAX_AVATARS_COLLAPSED && ai < againstVoters.length) interleaved.push(againstVoters[ai++])
  }

  const overflow = data.total - interleaved.length

  return (
    <div className={cn('rounded-xl border border-surface-300 bg-surface-100 overflow-hidden', className)}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-200 transition-colors group"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Users className="h-4 w-4 text-for-400 flex-shrink-0" />
          <span className="text-xs font-mono font-semibold text-white truncate">
            People you follow voted
          </span>
          {/* Summary pills */}
          <span className="flex items-center gap-1.5 flex-shrink-0">
            {data.for_count > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-for-600/20 text-for-400 border border-for-600/30">
                {data.for_count} For
              </span>
            )}
            {data.against_count > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-against-600/20 text-against-400 border border-against-600/30">
                {data.against_count} Against
              </span>
            )}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 group-hover:text-white transition-colors" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 group-hover:text-white transition-colors" />
        )}
      </button>

      {/* Collapsed avatar strip */}
      {!expanded && (
        <div className="px-4 pb-3 flex items-center gap-1.5">
          {interleaved.map((voter) => (
            <Link
              key={voter.id}
              href={`/profile/${voter.username}`}
              title={`${voter.display_name ?? voter.username} voted ${voter.side === 'blue' ? 'For' : 'Against'}`}
              className={cn(
                'flex-shrink-0 rounded-full ring-2 transition-transform hover:scale-110',
                voter.side === 'blue' ? 'ring-for-500' : 'ring-against-500'
              )}
            >
              <Avatar
                src={voter.avatar_url}
                fallback={voter.display_name ?? voter.username}
                size="sm"
              />
            </Link>
          ))}
          {overflow > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-surface-300 border border-surface-400 text-[10px] font-mono font-bold text-surface-500 hover:bg-surface-200 hover:text-white transition-colors"
              aria-label={`${overflow} more`}
            >
              +{overflow}
            </button>
          )}
        </div>
      )}

      {/* Expanded list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-3">
              {/* For section */}
              {forVoters.length > 0 && (
                <div>
                  <p className="text-[10px] font-mono font-semibold text-for-400 uppercase tracking-widest mb-2">
                    For — {forVoters.length}
                  </p>
                  <div className="space-y-2">
                    {forVoters.map((voter) => (
                      <VoterRow key={voter.id} voter={voter} />
                    ))}
                  </div>
                </div>
              )}

              {/* Against section */}
              {againstVoters.length > 0 && (
                <div className={forVoters.length > 0 ? 'pt-2 border-t border-surface-300' : ''}>
                  <p className="text-[10px] font-mono font-semibold text-against-400 uppercase tracking-widest mb-2">
                    Against — {againstVoters.length}
                  </p>
                  <div className="space-y-2">
                    {againstVoters.map((voter) => (
                      <VoterRow key={voter.id} voter={voter} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function VoterRow({ voter }: { voter: FollowingVoter }) {
  return (
    <Link
      href={`/profile/${voter.username}`}
      className="flex items-center gap-2.5 group hover:opacity-90 transition-opacity"
    >
      <div className={cn(
        'flex-shrink-0 rounded-full',
        voter.side === 'blue' ? 'ring-1 ring-for-500/60' : 'ring-1 ring-against-500/60'
      )}>
        <Avatar
          src={voter.avatar_url}
          fallback={voter.display_name ?? voter.username}
          size="sm"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white truncate group-hover:text-for-300 transition-colors">
          {voter.display_name ?? voter.username}
        </p>
        <p className="text-[10px] font-mono text-surface-500 truncate">
          @{voter.username}
        </p>
      </div>
      <span className={cn(
        'flex-shrink-0 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded',
        voter.side === 'blue'
          ? 'bg-for-600/20 text-for-400'
          : 'bg-against-600/20 text-against-400'
      )}>
        {voter.side === 'blue' ? 'For' : 'Against'}
      </span>
    </Link>
  )
}
