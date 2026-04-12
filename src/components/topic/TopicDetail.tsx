'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, Globe, Tag } from 'lucide-react'
import type { Topic, Profile, VoteSide } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { VoteBar } from '@/components/voting/VoteBar'
import { VoteButton } from '@/components/voting/VoteButton'
import { VoteTimer } from '@/components/voting/VoteTimer'
import { SupportButton } from '@/components/voting/SupportButton'
import { useVoteStore } from '@/lib/stores/vote-store'
import { useFeedStore } from '@/lib/stores/feed-store'
import { useState } from 'react'

interface TopicDetailProps {
  initialTopic: Topic
  author: Profile | null
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

export function TopicDetail({ initialTopic, author }: TopicDetailProps) {
  const router = useRouter()
  const [topic, setTopic] = useState<Topic>(initialTopic)
  const [hasSupported, setHasSupported] = useState(false)
  const { castVote, hasVoted, getVoteSide } = useVoteStore()
  const updateTopic = useFeedStore((s) => s.updateTopic)
  const votedSide = getVoteSide(topic.id)
  const isVotable = topic.status === 'active' || topic.status === 'voting'
  const isProposed = topic.status === 'proposed'

  // Subscribe to Supabase Realtime for live vote updates
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`topic-${topic.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'topics',
          filter: `id=eq.${topic.id}`,
        },
        (payload) => {
          const updated = payload.new as Topic
          setTopic(updated)
          updateTopic(topic.id, updated)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [topic.id, updateTopic])

  const handleVote = async (side: VoteSide) => {
    // Optimistic update
    const isBlue = side === 'blue'
    const newTotal = topic.total_votes + 1
    const newBlue = topic.blue_votes + (isBlue ? 1 : 0)
    setTopic((prev) => ({
      ...prev,
      total_votes: newTotal,
      blue_votes: newBlue,
      red_votes: prev.red_votes + (isBlue ? 0 : 1),
      blue_pct: (newBlue / newTotal) * 100,
    }))
    updateTopic(topic.id, {
      total_votes: newTotal,
      blue_votes: newBlue,
      blue_pct: (newBlue / newTotal) * 100,
    })
    await castVote(topic.id, side)
  }

  const handleSupport = async () => {
    try {
      const res = await fetch(`/api/topics/${topic.id}/support`, {
        method: 'POST',
      })
      if (res.ok) {
        const { topic: updated } = await res.json()
        setTopic(updated)
        setHasSupported(true)
        updateTopic(topic.id, {
          support_count: updated.support_count,
          status: updated.status,
        })
      }
    } catch (err) {
      console.error('Support failed:', err)
    }
  }

  const createdDate = new Date(topic.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-surface-100 border-b border-surface-300">
        <div className="max-w-2xl mx-auto flex items-center h-14 px-4 gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium text-surface-500">Topic</span>
          <div className="ml-auto">
            <Badge variant={statusBadgeVariant[topic.status] ?? 'proposed'}>
              {statusLabel[topic.status] ?? topic.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Statement */}
        <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-8">
          {topic.statement}
        </h1>

        {/* Vote area */}
        {isVotable && (
          <div className="space-y-5 mb-8">
            <VoteBar
              bluePct={topic.blue_pct}
              totalVotes={topic.total_votes}
              showLabels
            />
            <VoteButton
              topicId={topic.id}
              bluePct={topic.blue_pct}
              onVote={handleVote}
              disabled={hasVoted(topic.id)}
              votedSide={votedSide}
            />
            {topic.voting_ends_at && (
              <div className="flex justify-center">
                <VoteTimer endsAt={topic.voting_ends_at} />
              </div>
            )}
          </div>
        )}

        {/* Support area */}
        {isProposed && (
          <div className="flex justify-center mb-8">
            <SupportButton
              topicId={topic.id}
              supportCount={topic.support_count}
              threshold={topic.activation_threshold}
              hasSupported={hasSupported}
              onSupport={handleSupport}
            />
          </div>
        )}

        {/* Law badge */}
        {topic.status === 'law' && (
          <div className="flex justify-center mb-8">
            <Badge variant="law" className="text-lg px-6 py-2">
              LAW
            </Badge>
          </div>
        )}

        {/* Metadata */}
        <div className="bg-surface-100 border border-surface-300 rounded-xl p-5 space-y-4">
          {/* Author */}
          <div className="flex items-center gap-3">
            <Avatar
              src={author?.avatar_url}
              fallback={author?.display_name || author?.username || 'U'}
              size="md"
            />
            <div>
              <p className="text-sm font-medium text-white">
                {author?.display_name || author?.username || 'Anonymous'}
              </p>
              {author?.username && (
                <p className="text-xs text-surface-500">@{author.username}</p>
              )}
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-surface-300">
            {topic.category && (
              <div className="flex items-center gap-2 text-sm text-surface-500">
                <Tag className="h-4 w-4" />
                <span>{topic.category}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-surface-500">
              <Globe className="h-4 w-4" />
              <span>{topic.scope}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-surface-500">
              <Calendar className="h-4 w-4" />
              <span>{createdDate}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
