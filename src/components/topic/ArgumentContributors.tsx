'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ThumbsUp, ThumbsDown, MessageSquare, Users } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { TopicContributor, ContributorsResponse } from '@/app/api/topics/[id]/contributors/route'

interface ArgumentContributorsProps {
  topicId: string
  className?: string
}

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  debator:       { label: 'Debator',      color: 'text-for-400' },
  troll_catcher: { label: 'T-Catcher',    color: 'text-emerald' },
  elder:         { label: 'Elder',        color: 'text-gold' },
}

function ContributorRow({
  contributor,
  rank,
}: {
  contributor: TopicContributor
  rank: number
}) {
  const roleInfo = ROLE_BADGE[contributor.role]
  const sideColor =
    contributor.dominant_side === 'for'
      ? 'text-for-400'
      : contributor.dominant_side === 'against'
      ? 'text-against-400'
      : 'text-surface-500'
  const sideBg =
    contributor.dominant_side === 'for'
      ? 'bg-for-500/10 border-for-500/20'
      : contributor.dominant_side === 'against'
      ? 'bg-against-500/10 border-against-500/20'
      : 'bg-surface-300/10 border-surface-400/20'

  return (
    <Link
      href={`/profile/${contributor.username}`}
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 rounded-xl',
        'border border-transparent hover:border-surface-400/40',
        'bg-transparent hover:bg-surface-200/40',
        'transition-all duration-150 group'
      )}
    >
      {/* Rank */}
      <span
        className={cn(
          'flex-shrink-0 w-5 text-center text-xs font-mono font-bold',
          rank === 1 ? 'text-gold' : rank === 2 ? 'text-surface-400' : rank === 3 ? 'text-amber-600' : 'text-surface-600'
        )}
      >
        {rank}
      </span>

      {/* Avatar */}
      <Avatar
        src={contributor.avatar_url}
        fallback={contributor.display_name || contributor.username}
        size="sm"
        className="flex-shrink-0"
      />

      {/* Name + role */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white truncate group-hover:text-for-300 transition-colors">
          {contributor.display_name || contributor.username}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] font-mono text-surface-600">
            @{contributor.username}
          </span>
          {roleInfo && (
            <span className={cn('text-[9px] font-mono font-bold uppercase tracking-wide', roleInfo.color)}>
              {roleInfo.label}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Argument count */}
        <div className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
          <MessageSquare className="h-2.5 w-2.5" />
          {contributor.argument_count}
        </div>

        {/* Dominant side + upvotes */}
        <div
          className={cn(
            'flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono font-semibold',
            sideBg, sideColor
          )}
        >
          {contributor.dominant_side === 'for' ? (
            <ThumbsUp className="h-2.5 w-2.5" />
          ) : contributor.dominant_side === 'against' ? (
            <ThumbsDown className="h-2.5 w-2.5" />
          ) : null}
          {contributor.total_upvotes > 0 && (
            <span>{contributor.total_upvotes}</span>
          )}
        </div>
      </div>
    </Link>
  )
}

export function ArgumentContributors({ topicId, className }: ArgumentContributorsProps) {
  const [contributors, setContributors] = useState<TopicContributor[]>([])
  const [totalArguments, setTotalArguments] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/topics/${topicId}/contributors`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ContributorsResponse | null) => {
        if (data) {
          setContributors(data.contributors)
          setTotalArguments(data.total_arguments)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [topicId])

  if (!loading && contributors.length === 0) return null

  return (
    <div className={cn('rounded-xl border border-surface-300 bg-surface-100 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-surface-300">
        <Users className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" aria-hidden />
        <span className="text-xs font-mono text-surface-500 uppercase tracking-wider flex-1">
          Top Contributors
        </span>
        {totalArguments > 0 && (
          <span className="text-[10px] font-mono text-surface-600">
            {totalArguments} argument{totalArguments !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* List */}
      <div className="py-1">
        {loading ? (
          <div className="space-y-1 px-2 py-1">
            {[0, 1, 2, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2">
                <Skeleton className="h-3 w-4 flex-shrink-0" />
                <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2 w-16" />
                </div>
                <Skeleton className="h-5 w-16 rounded flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : (
          contributors.map((c, i) => (
            <ContributorRow key={c.user_id} contributor={c} rank={i + 1} />
          ))
        )}
      </div>
    </div>
  )
}
