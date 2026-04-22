'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Check, Loader2, LogIn, ThumbsDown, ThumbsUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useVoteStore } from '@/lib/stores/vote-store'
import { cn } from '@/lib/utils/cn'

interface BriefVotePanelProps {
  topicId: string
  isVotable: boolean
  topicHref: string
}

export function BriefVotePanel({ topicId, isVotable, topicHref }: BriefVotePanelProps) {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [casting, setCasting] = useState(false)
  const [justVoted, setJustVoted] = useState<'blue' | 'red' | null>(null)

  const { castVote, hasVoted, getVoteSide } = useVoteStore()
  const voted = hasVoted(topicId)
  const side = getVoteSide(topicId)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setAuthed(!!user))
  }, [])

  const handleVote = useCallback(
    async (choice: 'blue' | 'red') => {
      if (!isVotable || voted || casting) return
      setCasting(true)
      try {
        await castVote(topicId, choice)
        setJustVoted(choice)
      } catch {
        // swallow — vote store handles the toast/error
      } finally {
        setCasting(false)
      }
    },
    [isVotable, voted, casting, castVote, topicId]
  )

  // Not yet fetched auth status
  if (authed === null) {
    return (
      <div className="flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-surface-500" />
      </div>
    )
  }

  // Not logged in
  if (!authed) {
    return (
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 text-center space-y-3">
        <LogIn className="h-5 w-5 text-surface-500 mx-auto" aria-hidden />
        <p className="text-sm font-mono text-surface-500">
          Sign in to cast your vote
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(topicHref + '/brief')}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-for-600 text-white text-sm font-mono font-semibold hover:bg-for-500 transition-colors"
        >
          Sign in
        </Link>
      </div>
    )
  }

  // Topic not open for voting
  if (!isVotable) {
    return (
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 text-center">
        <p className="text-sm font-mono text-surface-500 mb-2">Voting is not open right now.</p>
        <Link
          href={topicHref}
          className="text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
        >
          View topic details
        </Link>
      </div>
    )
  }

  // Already voted
  if (voted || justVoted) {
    const confirmedSide = justVoted ?? side
    const isFor = confirmedSide === 'blue'
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'rounded-2xl border p-5 flex flex-col items-center gap-3 text-center',
          isFor
            ? 'bg-for-600/10 border-for-600/30'
            : 'bg-against-600/10 border-against-600/30'
        )}
      >
        <div
          className={cn(
            'flex items-center justify-center h-10 w-10 rounded-full',
            isFor ? 'bg-for-600/20 border border-for-600/40' : 'bg-against-600/20 border border-against-600/40'
          )}
        >
          {isFor ? (
            <ThumbsUp className="h-5 w-5 text-for-400" aria-hidden />
          ) : (
            <ThumbsDown className="h-5 w-5 text-against-400" aria-hidden />
          )}
        </div>
        <div>
          <p
            className={cn(
              'font-mono text-sm font-semibold',
              isFor ? 'text-for-400' : 'text-against-400'
            )}
          >
            You voted {isFor ? 'FOR' : 'AGAINST'}
          </p>
          <p className="text-[11px] font-mono text-surface-500 mt-0.5">
            Your stance is recorded.
          </p>
        </div>
        {justVoted && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald">
            <Check className="h-3.5 w-3.5" aria-hidden />
            Vote cast
          </div>
        )}
        <Link
          href={topicHref}
          className="text-[11px] font-mono text-surface-500 hover:text-surface-300 transition-colors mt-1"
        >
          View full debate
        </Link>
      </motion.div>
    )
  }

  // Ready to vote
  return (
    <div className="grid grid-cols-2 gap-3" role="group" aria-label="Cast your vote">
      <motion.button
        whileTap={{ scale: 0.97 }}
        disabled={casting}
        onClick={() => handleVote('blue')}
        aria-label="Vote for this topic"
        className={cn(
          'flex flex-col items-center justify-center gap-2 py-4 rounded-xl font-mono font-semibold text-sm transition-colors',
          'bg-for-600 text-white hover:bg-for-500',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {casting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ThumbsUp className="h-5 w-5" aria-hidden />
        )}
        <span>FOR</span>
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.97 }}
        disabled={casting}
        onClick={() => handleVote('red')}
        aria-label="Vote against this topic"
        className={cn(
          'flex flex-col items-center justify-center gap-2 py-4 rounded-xl font-mono font-semibold text-sm transition-colors',
          'bg-against-600 text-white hover:bg-against-500',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {casting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ThumbsDown className="h-5 w-5" aria-hidden />
        )}
        <span>AGAINST</span>
      </motion.button>
    </div>
  )
}
