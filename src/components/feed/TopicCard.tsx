'use client'

import Link from 'next/link'
import { Share2, Eye } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { Topic, VoteSide } from '@/lib/supabase/types'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { VoteBar } from '@/components/voting/VoteBar'
import { VoteButton } from '@/components/voting/VoteButton'
import { VoteTimer } from '@/components/voting/VoteTimer'
import { SupportButton } from '@/components/voting/SupportButton'
import { useVoteStore } from '@/lib/stores/vote-store'
import { useFeedStore } from '@/lib/stores/feed-store'

interface TopicCardProps {
  topic: Topic
  authorName?: string
  authorAvatar?: string | null
}

const statusLabel: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
  continued: 'Continued',
  archived: 'Archived',
}

const statusBadgeVariant: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
  continued: 'proposed',
  archived: 'proposed',
}

function glowForStatus(status: string): 'blue' | 'red' | 'gold' | undefined {
  if (status === 'law') return 'gold'
  return undefined
}

export function TopicCard({ topic, authorName, authorAvatar }: TopicCardProps) {
  const { castVote, hasVoted, getVoteSide } = useVoteStore()
  const updateTopic = useFeedStore((s) => s.updateTopic)
  const votedSide = getVoteSide(topic.id)
  const isVotable = topic.status === 'active' || topic.status === 'voting'
  const isProposed = topic.status === 'proposed'
  const isLaw = topic.status === 'law'

  const handleVote = async (side: VoteSide) => {
    await castVote(topic.id, side)
    // Optimistic: update feed store
    const isBlue = side === 'blue'
    updateTopic(topic.id, {
      total_votes: topic.total_votes + 1,
      blue_votes: topic.blue_votes + (isBlue ? 1 : 0),
      red_votes: topic.red_votes + (isBlue ? 0 : 1),
      blue_pct:
        ((topic.blue_votes + (isBlue ? 1 : 0)) /
          (topic.total_votes + 1)) *
        100,
    })
  }

  const handleSupport = async () => {
    try {
      const res = await fetch(`/api/topics/${topic.id}/support`, {
        method: 'POST',
      })
      if (res.ok) {
        const { topic: updated } = await res.json()
        updateTopic(topic.id, {
          support_count: updated.support_count,
          status: updated.status,
        })
      }
    } catch (err) {
      console.error('Support failed:', err)
    }
  }

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const url = `${window.location.origin}/topic/${topic.id}`
    if (navigator.share) {
      try {
        await navigator.share({ title: topic.statement, url })
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url)
    }
  }

  return (
    <div className="feed-card relative flex items-center justify-center px-4 py-6">
      <Link href={`/topic/${topic.id}`} className="w-full max-w-lg">
        <Card
          glow={glowForStatus(topic.status)}
          className={cn(
            'relative flex flex-col h-full min-h-[70dvh] max-h-[85dvh]',
            'bg-surface-100 overflow-hidden'
          )}
        >
          {/* Top row: category + status */}
          <div className="flex items-center justify-between mb-6">
            {topic.category && (
              <Badge variant="proposed" className="text-surface-500">
                {topic.category}
              </Badge>
            )}
            <Badge variant={statusBadgeVariant[topic.status] ?? 'proposed'}>
              {statusLabel[topic.status] ?? topic.status}
            </Badge>
          </div>

          {/* Center: statement */}
          <div className="flex-1 flex items-center justify-center py-4">
            <p className="text-2xl md:text-3xl font-bold text-center text-white leading-tight">
              {topic.statement}
            </p>
          </div>

          {/* Voting / Support area */}
          <div className="mt-auto space-y-4">
            {isVotable && (
              <>
                <VoteBar
                  bluePct={topic.blue_pct}
                  totalVotes={topic.total_votes}
                />
                <div onClick={(e) => e.preventDefault()}>
                  <VoteButton
                    topicId={topic.id}
                    bluePct={topic.blue_pct}
                    onVote={handleVote}
                    disabled={hasVoted(topic.id)}
                    votedSide={votedSide}
                  />
                </div>
                {topic.voting_ends_at && (
                  <div className="flex justify-center">
                    <VoteTimer endsAt={topic.voting_ends_at} />
                  </div>
                )}
              </>
            )}

            {isProposed && (
              <div
                className="flex justify-center"
                onClick={(e) => e.preventDefault()}
              >
                <SupportButton
                  topicId={topic.id}
                  supportCount={topic.support_count}
                  threshold={topic.activation_threshold}
                  hasSupported={false}
                  onSupport={handleSupport}
                />
              </div>
            )}

            {isLaw && (
              <div className="flex justify-center">
                <Badge variant="law" className="text-base px-4 py-1.5">
                  LAW
                </Badge>
              </div>
            )}

            {/* Author + view count */}
            <div className="flex items-center justify-between pt-2 border-t border-surface-300">
              <div className="flex items-center gap-2">
                <Avatar
                  src={authorAvatar}
                  fallback={authorName || 'U'}
                  size="sm"
                />
                <span className="text-sm text-surface-500">
                  {authorName || 'Anonymous'}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-surface-500">
                <Eye className="h-3.5 w-3.5" />
                <AnimatedNumber value={topic.view_count} />
              </div>
            </div>
          </div>
        </Card>
      </Link>

      {/* Right-side action rail */}
      <div className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-surface-500">Votes</span>
          <span className="text-sm font-semibold text-white">
            <AnimatedNumber value={topic.total_votes} />
          </span>
        </div>
        <button
          onClick={handleShare}
          className="flex items-center justify-center h-10 w-10 rounded-full bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
          aria-label="Share"
        >
          <Share2 className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
