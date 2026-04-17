'use client'

/**
 * ArgumentSpotlight
 *
 * Shown at the top of the Arguments tab when a topic has at least one
 * upvoted argument on each side.  Surfaces the single highest-upvoted FOR
 * argument and the single highest-upvoted AGAINST argument as a compact
 * side-by-side preview — giving visitors an instant read of the debate
 * before scrolling through the full thread.
 *
 * Lazy-loads on mount via the existing /api/topics/[id]/arguments endpoint;
 * the ArgumentThread below can reuse the same data without a double fetch
 * because it makes its own call independently.
 *
 * Hidden when:
 *  - There are no arguments yet
 *  - Only one side has arguments
 *  - The top argument has 0 upvotes (no social signal yet)
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ThumbsUp, ThumbsDown, Sparkles } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type { TopicArgumentWithAuthor } from '@/lib/supabase/types'

interface ArgumentSpotlightProps {
  topicId: string
  className?: string
}

interface SpotlightArg {
  id: string
  content: string
  upvotes: number
  side: 'blue' | 'red'
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

function truncate(text: string, max = 200): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

function ArgCard({
  arg,
  side,
}: {
  arg: SpotlightArg
  side: 'for' | 'against'
}) {
  const isFor = side === 'for'
  return (
    <div
      className={cn(
        'flex-1 min-w-0 rounded-xl border p-4 space-y-3 transition-colors',
        isFor
          ? 'bg-for-950/30 border-for-600/20 hover:border-for-500/40'
          : 'bg-against-950/30 border-against-600/20 hover:border-against-500/40'
      )}
    >
      {/* Side label */}
      <div className="flex items-center gap-2">
        {isFor ? (
          <ThumbsUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0" aria-hidden="true" />
        ) : (
          <ThumbsDown className="h-3.5 w-3.5 text-against-400 flex-shrink-0" aria-hidden="true" />
        )}
        <span
          className={cn(
            'text-[10px] font-mono font-bold uppercase tracking-widest',
            isFor ? 'text-for-400' : 'text-against-400'
          )}
        >
          {isFor ? 'Top FOR' : 'Top AGAINST'}
        </span>
        {arg.upvotes > 0 && (
          <span
            className={cn(
              'ml-auto text-[10px] font-mono font-semibold tabular-nums',
              isFor ? 'text-for-500' : 'text-against-500'
            )}
          >
            +{arg.upvotes}
          </span>
        )}
      </div>

      {/* Argument text */}
      <p className="text-sm text-surface-700 leading-relaxed font-mono">
        {truncate(arg.content)}
      </p>

      {/* Author */}
      {arg.author && (
        <Link
          href={`/profile/${arg.author.username}`}
          className="flex items-center gap-2 group"
          aria-label={`Argument by ${arg.author.display_name ?? arg.author.username}`}
        >
          <Avatar
            src={arg.author.avatar_url}
            fallback={arg.author.display_name ?? arg.author.username}
            size="xs"
          />
          <span className="text-[11px] font-mono text-surface-500 group-hover:text-white transition-colors truncate">
            @{arg.author.username}
          </span>
        </Link>
      )}
    </div>
  )
}

export function ArgumentSpotlight({ topicId, className }: ArgumentSpotlightProps) {
  const [forTop, setForTop] = useState<SpotlightArg | null>(null)
  const [againstTop, setAgainstTop] = useState<SpotlightArg | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    fetch(`/api/topics/${topicId}/arguments`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { arguments: TopicArgumentWithAuthor[] } | null) => {
        if (cancelled || !data?.arguments) return

        const args = data.arguments
        const forArgs = args.filter((a) => a.side === 'blue')
        const againstArgs = args.filter((a) => a.side === 'red')

        const topFor = forArgs[0] ?? null
        const topAgainst = againstArgs[0] ?? null

        // Only show spotlight when both sides have at least one arg
        // and the top-upvoted arg has earned at least one upvote
        if (
          topFor &&
          topAgainst &&
          (topFor.upvotes > 0 || topAgainst.upvotes > 0)
        ) {
          const toSpotlight = (a: TopicArgumentWithAuthor): SpotlightArg => ({
            id: a.id,
            content: a.content,
            upvotes: a.upvotes,
            side: a.side,
            author: a.author ?? null,
          })
          setForTop(toSpotlight(topFor))
          setAgainstTop(toSpotlight(topAgainst))
        }

        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [topicId])

  if (!loaded || !forTop || !againstTop) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn('space-y-3', className)}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
        <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-surface-500">
          Top Arguments
        </span>
      </div>

      {/* Side-by-side cards */}
      <div className="flex gap-3 flex-col sm:flex-row">
        <ArgCard arg={forTop} side="for" />
        <ArgCard arg={againstTop} side="against" />
      </div>

      {/* Divider before the full thread */}
      <div className="border-t border-surface-300 pt-1" aria-hidden="true" />
    </motion.div>
  )
}
