'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  Calendar,
  Coins,
  GitBranch,
  GitCompare,
  Globe,
  Info,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Newspaper,
  ScrollText,
  Tag,
  ThumbsUp,
  Users,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Topic, Profile, VoteSide } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { VoteBar } from '@/components/voting/VoteBar'
import { VoteButton } from '@/components/voting/VoteButton'
import { VoteTimer } from '@/components/voting/VoteTimer'
import { VoteSheet } from '@/components/voting/VoteSheet'
import { StanceShareButton } from '@/components/voting/StanceShareButton'
import { SupportButton } from '@/components/voting/SupportButton'
import { ChainBanner } from '@/components/chain/ChainBanner'
import { ContinuationSection } from '@/components/chain/ContinuationSection'
import { ChainVisualization } from '@/components/chain/ChainVisualization'
import { LobbyBoard } from '@/components/lobby/LobbyBoard'
import { ArgumentThread } from '@/components/topic/ArgumentThread'
import { PredictionPanel } from '@/components/topic/PredictionPanel'
import { RelatedTopics } from '@/components/topic/RelatedTopics'
import { VoteTrend } from '@/components/topic/VoteTrend'
import { TopicStatusJourney } from '@/components/topic/TopicStatusJourney'
import { CoalitionStancePanel } from '@/components/topic/CoalitionStancePanel'
import { TopicDebatePanel } from '@/components/topic/TopicDebatePanel'
import { TopicWikiSection } from '@/components/topic/TopicWikiSection'
import { TopicBacklinks } from '@/components/topic/TopicBacklinks'
import { TopicSources } from '@/components/topic/TopicSources'
import { ReportButton } from '@/components/moderation/ReportButton'
import { SharePanel } from '@/components/ui/SharePanel'
import { BookmarkButton } from '@/components/ui/BookmarkButton'
import { AddToCollectionButton } from '@/components/ui/AddToCollectionButton'
import { TopicViewers } from '@/components/topic/TopicViewers'
import { ArgumentSpotlight } from '@/components/topic/ArgumentSpotlight'
import { TopicSubscribeButton } from '@/components/topic/TopicSubscribeButton'
import { cn } from '@/lib/utils/cn'
import { useVoteStore } from '@/lib/stores/vote-store'
import { useFeedStore } from '@/lib/stores/feed-store'
import { getTopicSignal, SIGNAL_PILL_CLASSES } from '@/lib/utils/topic-signal'
import { Clock, Flame, Gavel, Swords, TrendingUp, Zap } from 'lucide-react'
import { TopicReactions } from '@/components/topic/TopicReactions'
import { TopicHotTakes } from '@/components/topic/TopicHotTakes'
import { ArgumentContributors } from '@/components/topic/ArgumentContributors'
import { ArgumentCitationsPanel } from '@/components/topic/ArgumentCitationsPanel'
import { TopicAIBrief } from '@/components/topic/TopicAIBrief'
import { TopicBountyPanel } from '@/components/topic/TopicBountyPanel'
import { FollowingVotesPanel } from '@/components/topic/FollowingVotesPanel'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

const SIGNAL_ICONS_DETAIL: Record<string, typeof Flame> = {
  ending_soon:     Clock,
  brink_of_law:    Gavel,
  deadlock:        Swords,
  trending:        TrendingUp,
  gaining_support: Zap,
  strong_majority: Flame,
}

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

type TopicTab = 'details' | 'arguments' | 'lobbies' | 'bounties'

export function TopicDetail({ initialTopic, author }: TopicDetailProps) {
  const router = useRouter()
  const [topic, setTopic] = useState<Topic>(initialTopic)
  const [hasSupported, setHasSupported] = useState(false)
  const [activeTab, setActiveTab] = useState<TopicTab>('details')
  const [voteSheetOpen, setVoteSheetOpen] = useState(false)
  const [editorUsername, setEditorUsername] = useState<string | null>(null)
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

  // Fetch editor username when description_updated_by is set
  const descUpdatedBy = (topic as { description_updated_by?: string | null }).description_updated_by
  useEffect(() => {
    if (!descUpdatedBy) {
      setEditorUsername(null)
      return
    }
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('username')
      .eq('id', descUpdatedBy)
      .maybeSingle()
      .then(({ data }) => {
        setEditorUsername(data?.username ?? null)
      })
  }, [descUpdatedBy])

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

  // Record a view once per topic per browser session (best-effort, non-blocking)
  useEffect(() => {
    const key = `lm_viewed_${topic.id}`
    if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1')
      fetch(`/api/topics/${topic.id}/view`, { method: 'POST' }).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic.id])

  const handleVote = async (side: VoteSide, reason?: string) => {
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
    await castVote(topic.id, side, reason)
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
          {/* Live viewer presence — only shows when >1 person is viewing */}
          <TopicViewers topicId={topic.id} className="ml-3" />
          <div className="ml-auto flex items-center gap-2">
            <TopicSubscribeButton topicId={topic.id} />
            <BookmarkButton topicId={topic.id} />
            <AddToCollectionButton topicId={topic.id} />
            <Link
              href={`/share/debate/${topic.id}`}
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-lg',
                'bg-surface-200 border border-surface-300 text-surface-500',
                'hover:bg-surface-300 hover:text-for-400 transition-colors',
              )}
              title="Debate Snapshot — share the best arguments"
              aria-label="View debate snapshot"
            >
              <Newspaper className="h-3.5 w-3.5" />
            </Link>
            <Link
              href={`/topic/${topic.id}/chat`}
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-lg',
                'bg-surface-200 border border-surface-300 text-surface-500',
                'hover:bg-surface-300 hover:text-for-400 transition-colors',
              )}
              title="Live Chat — discuss this topic in real-time"
              aria-label="Live chat"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </Link>
            <Link
              href={`/compare?a=${topic.id}`}
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-lg',
                'bg-surface-200 border border-surface-300 text-surface-500',
                'hover:bg-surface-300 hover:text-purple transition-colors',
              )}
              title="Compare with another topic"
              aria-label="Compare with another topic"
            >
              <GitCompare className="h-3.5 w-3.5" />
            </Link>
            <SharePanel
              url={typeof window !== 'undefined' ? window.location.href : `/topic/${topic.id}`}
              text={`${topic.statement} — ${Math.round(topic.blue_pct)}% For on Lobby Market`}
              topicId={topic.id}
            />
            <Badge variant={statusBadgeVariant[topic.status] ?? 'proposed'}>
              {statusLabel[topic.status] ?? topic.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Statement */}
        <div className="flex items-start justify-between gap-3 mb-2">
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

        {/* Relevance signal pill — shown when the topic has a notable status */}
        {(() => {
          const signal = getTopicSignal(topic)
          if (!signal) return null
          const classes = SIGNAL_PILL_CLASSES[signal.color]
          const Icon = SIGNAL_ICONS_DETAIL[signal.id] ?? Flame
          return (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold border mb-6',
                classes.pill,
              )}
              title={signal.description}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full animate-pulse', classes.dot)} aria-hidden="true" />
              <Icon className="h-3 w-3" aria-hidden="true" />
              {signal.label}
              <span className="text-[10px] opacity-60 ml-0.5">· {signal.description}</span>
            </span>
          )
        })()}

        {/* Tabs — Details / Arguments / Lobbies */}
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
            onClick={() => setActiveTab('arguments')}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 font-mono text-xs font-semibold transition-colors border-b-2',
              activeTab === 'arguments'
                ? 'text-emerald border-emerald'
                : 'text-surface-500 border-transparent hover:text-white'
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Arguments
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
          <button
            type="button"
            onClick={() => setActiveTab('bounties')}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 font-mono text-xs font-semibold transition-colors border-b-2',
              activeTab === 'bounties'
                ? 'text-gold border-gold'
                : 'text-surface-500 border-transparent hover:text-white'
            )}
          >
            <Coins className="h-3.5 w-3.5" />
            Bounties
          </button>
        </div>

        {activeTab === 'bounties' ? (
          <ErrorBoundary size="md" label="Couldn't load bounties">
            <TopicBountyPanel
              topicId={topic.id}
              topicStatus={topic.status}
            />
          </ErrorBoundary>
        ) : activeTab === 'lobbies' ? (
          <ErrorBoundary size="md" label="Couldn't load lobby board">
            <LobbyBoard topicId={topic.id} />
          </ErrorBoundary>
        ) : activeTab === 'arguments' ? (
          <ErrorBoundary size="md" label="Couldn't load arguments">
            <>
              {/* AI brief — neutral Claude-generated debate summary */}
              <TopicAIBrief topicId={topic.id} className="mb-6" />
              {/* Spotlight: top FOR + AGAINST argument preview */}
              <ArgumentSpotlight topicId={topic.id} className="mb-6" />
              <ArgumentThread topicId={topic.id} />
            </>
          </ErrorBoundary>
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
                {topic.total_votes > 0 && (
                  <div className="flex justify-center gap-4 flex-wrap">
                    <Link
                      href={`/topic/${topic.id}/voters`}
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                    >
                      <Users className="h-3.5 w-3.5" />
                      See who voted
                    </Link>
                    <Link
                      href={`/topic/${topic.id}/timeline`}
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                    >
                      <Clock className="h-3.5 w-3.5" />
                      View timeline
                    </Link>
                    <Link
                      href={`/topic/${topic.id}/brief`}
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      Read brief
                    </Link>
                    <Link
                      href={`/topic/${topic.id}/transcript`}
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                    >
                      <ScrollText className="h-3.5 w-3.5" />
                      Transcript
                    </Link>
                    <Link
                      href={`/topic/${topic.id}/argument-graph`}
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald hover:text-emerald/80 transition-colors"
                    >
                      <GitBranch className="h-3.5 w-3.5" />
                      Argument graph
                    </Link>
                    <Link
                      href={`/topic/${topic.id}/stats`}
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-gold hover:text-gold/80 transition-colors"
                    >
                      <BarChart2 className="h-3.5 w-3.5" />
                      Stats
                    </Link>
                    <Link
                      href={`/spar/${topic.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-purple hover:text-purple/80 transition-colors"
                    >
                      <Swords className="h-3.5 w-3.5" />
                      Spar with AI
                    </Link>
                  </div>
                )}
                <VoteButton
                  topicId={topic.id}
                  bluePct={topic.blue_pct}
                  onVote={handleVote}
                  disabled={hasVoted(topic.id)}
                  votedSide={votedSide}
                />
                {/* Share stance — surfaces after the user votes */}
                {hasVoted(topic.id) && votedSide && (
                  <div className="flex justify-center">
                    <StanceShareButton
                      topicId={topic.id}
                      statement={topic.statement}
                      votedSide={votedSide}
                      forPct={topic.blue_pct}
                      totalVotes={topic.total_votes}
                      category={topic.category}
                    />
                  </div>
                )}
                {topic.voting_ends_at && (
                  <div className="flex justify-center">
                    <VoteTimer endsAt={topic.voting_ends_at} />
                  </div>
                )}
              </div>
            )}

            {/* Following votes — social proof panel */}
            <ErrorBoundary size="xs" className="mb-4">
              <FollowingVotesPanel topicId={topic.id} className="mb-4" />
            </ErrorBoundary>

            {/* Community reactions */}
            <div className="mb-6">
              <p className="text-xs font-mono text-surface-500 mb-2 uppercase tracking-wide">
                Community reads this as
              </p>
              <TopicReactions topicId={topic.id} size="md" />
            </div>

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
                {topic.total_votes > 0 && (
                  <Link
                    href={`/topic/${topic.id}/voters`}
                    className="flex items-center gap-2 text-sm text-surface-500 hover:text-for-400 transition-colors group"
                  >
                    <Users className="h-4 w-4 group-hover:text-for-400 transition-colors" />
                    <span>{topic.total_votes.toLocaleString()} voters</span>
                  </Link>
                )}
              </div>
            </div>

            {/* Topic context / wiki description — editable by author */}
            <ErrorBoundary size="sm" label="Couldn't load wiki section">
              <TopicWikiSection
                topicId={topic.id}
                authorId={topic.author_id}
                description={topic.description}
                onUpdate={(desc) => setTopic((prev) => ({ ...prev, description: desc }))}
                updatedAt={(topic as { description_updated_at?: string | null }).description_updated_at ?? null}
                updatedByUsername={editorUsername}
              />
            </ErrorBoundary>

            {/* Wiki link graph — backlinks & outgoing topic wikilinks */}
            <ErrorBoundary size="xs" className="mt-4">
              <TopicBacklinks topicId={topic.id} className="mt-4" />
            </ErrorBoundary>

            {/* Pinned sources — factual citations added by topic author/moderators */}
            <ErrorBoundary size="xs" className="mt-4">
              <div className="mt-4">
                <TopicSources topicId={topic.id} topicAuthorId={topic.author_id} />
              </div>
            </ErrorBoundary>

            {/* Evidence cited in arguments — aggregate of all source_url links */}
            <ErrorBoundary size="xs" className="mt-3">
              <ArgumentCitationsPanel topicId={topic.id} className="mt-3" />
            </ErrorBoundary>

            {/* Topic journey — lifecycle progress stepper */}
            <ErrorBoundary size="sm" className="mt-6">
              <TopicStatusJourney
                status={topic.status}
                supportCount={topic.support_count}
                activationThreshold={topic.activation_threshold}
                totalVotes={topic.total_votes}
                bluePct={topic.blue_pct}
                votingEndsAt={topic.voting_ends_at}
                createdAt={topic.created_at}
                className="mt-6"
              />
            </ErrorBoundary>

            {/* Coalition stances — which factions are FOR / AGAINST */}
            {topic.status !== 'proposed' && (
              <ErrorBoundary size="sm" label="Couldn't load coalition stances" className="mt-6">
                <CoalitionStancePanel
                  topicId={topic.id}
                  className="mt-6"
                />
              </ErrorBoundary>
            )}

            {/* Debates — upcoming, live, and recently ended for this topic */}
            <ErrorBoundary size="sm" label="Couldn't load debates" className="mt-6">
              <TopicDebatePanel
                topicId={topic.id}
                className="mt-6"
              />
            </ErrorBoundary>

            {/* Vote trend — sparkline momentum chart */}
            {topic.total_votes >= 2 && topic.status !== 'proposed' && (
              <ErrorBoundary size="sm" label="Couldn't load vote trend" className="mt-6">
                <VoteTrend
                  topicId={topic.id}
                  className="mt-6"
                />
              </ErrorBoundary>
            )}

            {/* Community hot takes — vote reasons for this topic */}
            {topic.total_votes >= 1 && (
              <ErrorBoundary size="sm" label="Couldn't load hot takes" className="mt-6">
                <TopicHotTakes topicId={topic.id} />
              </ErrorBoundary>
            )}

            {/* Prediction market — Polymarket-style crowd predictions */}
            <ErrorBoundary size="sm" label="Couldn't load prediction market">
              <PredictionPanel topicId={topic.id} topicStatus={topic.status} />
            </ErrorBoundary>

            {/* Related topics — discovery section */}
            <ErrorBoundary size="sm" label="Couldn't load related topics" className="mt-8">
              <RelatedTopics topicId={topic.id} className="mt-8" />
            </ErrorBoundary>

            {/* Top argument contributors — ranked by upvotes received */}
            <ErrorBoundary size="sm" label="Couldn't load contributors" className="mt-6">
              <ArgumentContributors topicId={topic.id} className="mt-6" />
            </ErrorBoundary>

            {/* Extra bottom padding on mobile so the sticky CTA doesn't overlap content */}
            {isVotable && !hasVoted(topic.id) && (
              <div className="md:hidden h-24" aria-hidden="true" />
            )}
          </>
        )}
      </div>

      {/* ── Mobile sticky "Cast your vote" CTA ────────────────────────────── */}
      {/* Visible only on mobile, only when the topic is votable and unvoted. */}
      <AnimatePresence>
        {isVotable && !hasVoted(topic.id) && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className={cn(
              'fixed bottom-6 left-0 right-0 z-40',
              'flex justify-center px-6',
              'md:hidden', // Desktop has inline vote buttons; sheet is mobile-only
            )}
          >
            <button
              type="button"
              onClick={() => setVoteSheetOpen(true)}
              aria-label="Open voting panel"
              className={cn(
                'inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl',
                'bg-for-600 hover:bg-for-500 active:scale-95',
                'text-white font-mono font-semibold text-sm tracking-wide',
                'shadow-lg shadow-for-900/40',
                'transition-all duration-150',
                'border border-for-500/60',
                'w-full max-w-xs justify-center',
              )}
            >
              <ThumbsUp className="h-4 w-4" aria-hidden="true" />
              Cast Your Vote
              {/* Live percentage teaser */}
              <span className="ml-auto font-mono text-xs text-for-200 tabular-nums">
                {Math.round(topic.blue_pct)}% FOR
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Vote Sheet ────────────────────────────────────────────────────── */}
      <VoteSheet
        open={voteSheetOpen}
        onClose={() => setVoteSheetOpen(false)}
        topic={topic}
        onVote={handleVote}
        hasVoted={hasVoted(topic.id)}
        votedSide={votedSide}
      />
    </div>
  )
}
