'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  Globe,
  Info,
  Megaphone,
  Tag,
} from 'lucide-react'
import type { Topic, Profile, VoteSide } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { VoteBar } from '@/components/voting/VoteBar'
import { VoteButton } from '@/components/voting/VoteButton'
import { VoteTimer } from '@/components/voting/VoteTimer'
import { SupportButton } from '@/components/voting/SupportButton'
import { ChainBanner } from '@/components/chain/ChainBanner'
import { ContinuationSection } from '@/components/chain/ContinuationSection'
import { ChainVisualization } from '@/components/chain/ChainVisualization'
import { LobbyBoard } from '@/components/lobby/LobbyBoard'
import { ReportButton } from '@/components/moderation/ReportButton'
import { cn } from '@/lib/utils/cn'
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

type TopicTab = 'details' | 'lobbies'

export function TopicDetail({ initialTopic, author }: TopicDetailProps) {
  const router = useRouter()
  const [topic, setTopic] = useState<Topic>(initialTopic)
  const [hasSupported, setHasSupported] = useState(false)
  const [activeTab, setActiveTab] = useState<TopicTab>('details')
  const { castVote, hasVoted, getVoteSide } = useVoteStore()
  const updateTopic = useFeedStore((s) => s.updateTopic)
  const votedSide = getVoteSide(topic.id)
  const isProposed = topic.status === 'proposed'
  const isContinued = topic.status === 'continued'
  const isInContinuationVote =
    topic.status === 'voting' && topic.continuation_vote_ends_at !== null
  const isVotable =
    (topic.status === 'active' || topic.status === 'voting') &&
    !isInContinuationVote
  const showChainBanner = isContinued || isInContinuationVote
  const hasChainHistory = topic.chain_depth > 0 || topic.parent_id !== null

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
        <div className="flex items-start justify-between gap-3 mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight flex-1">
            {topic.statement}
          </h1>
          <ReportButton
            contentType="topic"
            contentId={topic.id}
            reportedUserId={topic.author_id}
            compact
          />
        </div>

        {/* Tabs — Details / Lobbies */}
        <div className="flex items-center gap-1 mb-8 border-b border-surface-300">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 font-mono text-xs font-semibold transition-colors border-b-2',
              activeTab === 'details'
                ? 'text-for-400 border-for-500'
                : 'text-surface-500 border-transparent hover:text-white'
            )}
          >
            <Info className="h-3.5 w-3.5" />
            Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('lobbies')}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 font-mono text-xs font-semibold transition-colors border-b-2',
              activeTab === 'lobbies'
                ? 'text-gold border-gold'
                : 'text-surface-500 border-transparent hover:text-white'
            )}
          >
            <Megaphone className="h-3.5 w-3.5" />
            Lobby Board
          </button>
        </div>

        {activeTab === 'lobbies' ? (
          <LobbyBoard topicId={topic.id} />
        ) : (
          <>
            {/* Chain banner — shown during the continuation lifecycle */}
            {showChainBanner && (
              <div className="mb-8">
                <ChainBanner topic={topic} />
              </div>
            )}

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

            {/* Continuation lifecycle — authoring, list, or plurality vote */}
            {showChainBanner && (
              <div className="mb-8">
                <ContinuationSection topic={topic} />
              </div>
            )}

            {/* Chain visualization — shown for any chained topic */}
            {hasChainHistory && (
              <div className="mb-8">
                <ChainVisualization topic={topic} />
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
                    <p className="text-xs text-surface-500">
                      @{author.username}
                    </p>
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
          </>
        )}
      </div>
    </div>
  )
}
