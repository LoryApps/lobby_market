'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Bot, Layers, Trophy, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import type {
  Debate,
  DebateSeries,
  DebateWithTopic,
  DebateParticipantWithProfile,
  DebateMessageWithAuthor,
  VoteSide,
} from '@/lib/supabase/types'
import { DebateSide } from './DebateSide'
import { DebateChat } from './DebateChat'
import { AudienceVotePulse } from './AudienceVotePulse'
import { DebateTimer } from './DebateTimer'
import {
  DebateReactions,
  ReactionTrigger,
  BLUE_EMOJIS,
  RED_EMOJIS,
  NEUTRAL_EMOJIS,
  type FloatingReaction,
} from './DebateReactions'
import { DebateRSVPButton } from './DebateRSVPButton'
import { CalendarExportButton } from './CalendarExportButton'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

interface DebateArenaProps {
  initialDebate: DebateWithTopic
  initialParticipants: DebateParticipantWithProfile[]
  initialMessages: DebateMessageWithAuthor[]
  currentUserId: string | null
}

function pickEmoji(side: VoteSide | null): string {
  const pool =
    side === 'blue'
      ? BLUE_EMOJIS
      : side === 'red'
        ? RED_EMOJIS
        : NEUTRAL_EMOJIS
  return pool[Math.floor(Math.random() * pool.length)]
}

export function DebateArena({
  initialDebate,
  initialParticipants,
  initialMessages,
  currentUserId,
}: DebateArenaProps) {
  const router = useRouter()
  const [debate, setDebate] = useState<DebateWithTopic>(initialDebate)
  const [participants, setParticipants] =
    useState<DebateParticipantWithProfile[]>(initialParticipants)
  const [messages, setMessages] =
    useState<DebateMessageWithAuthor[]>(initialMessages)
  const [reactions, setReactions] = useState<FloatingReaction[]>([])
  const [chatOpen, setChatOpen] = useState(true)
  const [series, setSeries] = useState<DebateSeries | null>(null)

  const reactionIdRef = useRef(0)

  // Load series context if this debate is part of a series
  useEffect(() => {
    const sid = debate.series_id
    if (!sid) return
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('debate_series')
        .select('id, title, format, blue_wins, red_wins, status, winner_side, creator_id, topic_id, description, created_at, updated_at')
        .eq('id', sid)
        .maybeSingle()
      if (!cancelled && data) setSeries(data as DebateSeries)
    })()
    return () => { cancelled = true }
  }, [debate.series_id])

  const blueSpeaker = useMemo(
    () => participants.find((p) => p.side === 'blue' && p.is_speaker) ?? null,
    [participants]
  )
  const redSpeaker = useMemo(
    () => participants.find((p) => p.side === 'red' && p.is_speaker) ?? null,
    [participants]
  )

  // Subscribe to realtime: broadcast messages + reactions, postgres_changes for debate row
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase.channel(`debate:${debate.id}`, {
      config: { broadcast: { self: false } },
    })

    channel
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        const msg = payload as DebateMessageWithAuthor
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev
          return [...prev, msg]
        })
      })
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        const p = payload as { emoji: string; side: VoteSide | null }
        pushReaction(p.emoji, p.side)
      })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'debates',
          filter: `id=eq.${debate.id}`,
        },
        (payload) => {
          const updated = payload.new as Debate
          setDebate((prev) => ({ ...prev, ...updated }))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'debate_participants',
          filter: `debate_id=eq.${debate.id}`,
        },
        async (payload) => {
          const partial = payload.new as DebateParticipantWithProfile
          // Fetch profile detail for the new participant
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url, role')
            .eq('id', partial.user_id)
            .maybeSingle()
          setParticipants((prev) => {
            if (prev.some((p) => p.id === partial.id)) return prev
            return [...prev, { ...partial, profile: profile ?? null }]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debate.id])

  const pushReaction = useCallback(
    (emoji: string, side: VoteSide | null) => {
      reactionIdRef.current += 1
      const id = `r-${Date.now()}-${reactionIdRef.current}`
      setReactions((prev) => [
        ...prev.slice(-40), // cap total on screen
        { id, emoji, side, x: Math.random() },
      ])
    },
    []
  )

  const handleReactionExpire = useCallback((id: string) => {
    setReactions((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const handleSendMessage = useCallback(
    async (content: string, side: VoteSide | null) => {
      const res = await fetch(`/api/debates/${debate.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, side }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to send message')
      }
      const msg = (await res.json()) as DebateMessageWithAuthor
      // Optimistically append (server broadcast will ignore self events)
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    },
    [debate.id]
  )

  const handleSendReaction = useCallback(
    async (emoji: string, side: VoteSide | null) => {
      // Optimistic local float
      pushReaction(emoji, side)
      if (!currentUserId) return
      try {
        await fetch(`/api/debates/${debate.id}/reactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emoji, side }),
        })
      } catch {
        // Best-effort
      }
    },
    [debate.id, currentUserId, pushReaction]
  )

  const handleApplause = (side: VoteSide) => {
    handleSendReaction(pickEmoji(side), side)
  }

  const handleArenaTap = (side: VoteSide | null) => {
    handleSendReaction(pickEmoji(side), side)
  }

  const isLive = debate.status === 'live'

  return (
    <div className="fixed inset-0 bg-surface-0 text-white overflow-hidden">
      {/* Split background */}
      <div className="absolute inset-0 flex">
        <div className="flex-1 bg-gradient-to-br from-for-950 via-for-900/40 to-surface-0" />
        <div className="flex-1 bg-gradient-to-bl from-against-950 via-against-900/40 to-surface-0" />
      </div>

      {/* Subtle center divider */}
      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" />

      {/* Top bar: back button + topic + timer + LIVE */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-start justify-between px-4 pt-4 gap-3">
        <button
          onClick={() => router.push('/debate')}
          className="h-10 w-10 rounded-full bg-black/50 backdrop-blur-md border border-surface-300 flex items-center justify-center text-white hover:bg-black/70 transition-colors flex-shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex-1 min-w-0 text-center flex flex-col items-center gap-2">
          {debate.topic?.statement && (
            <Link
              href={`/topic/${debate.topic.id}`}
              className="inline-block max-w-full"
            >
              <div className="px-4 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-surface-300 text-xs sm:text-sm font-mono text-white truncate max-w-[80vw] hover:border-for-500/50 transition-colors">
                {debate.topic.statement}
              </div>
            </Link>
          )}
          <DebateTimer phase={debate.phase} phaseEndsAt={debate.phase_ends_at} />
        </div>

        <div className="flex flex-col items-end gap-2">
          {isLive && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-against-500/20 backdrop-blur-md border border-against-500/50">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-against-500 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-against-500" />
              </span>
              <span className="font-mono text-[10px] font-bold text-against-300 uppercase tracking-wider">
                Live
              </span>
            </div>
          )}
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-surface-300">
            <Users className="h-3.5 w-3.5 text-surface-600" />
            <span className="font-mono text-[11px] text-white tabular-nums">
              {debate.viewer_count.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Series context strip — shown when this debate is part of a series */}
      {series && (
        <Link
          href={`/debate/series/${series.id}`}
          className="absolute top-[4.5rem] left-0 right-0 z-20 flex items-center justify-center px-4 pointer-events-auto"
        >
          <div className={cn(
            'inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono',
            'bg-purple/10 backdrop-blur-md border border-purple/30 text-purple',
            'hover:bg-purple/20 hover:border-purple/50 transition-all',
          )}>
            <Layers className="h-3 w-3 flex-shrink-0" />
            <span className="truncate max-w-[140px]">{series.title}</span>
            <span className="text-surface-500">·</span>
            {series.status === 'completed' && series.winner_side ? (
              <>
                <Trophy className="h-3 w-3" />
                <span className={series.winner_side === 'blue' ? 'text-for-400' : 'text-against-400'}>
                  {series.winner_side === 'blue' ? 'FOR wins' : 'AGAINST wins'}
                </span>
              </>
            ) : (
              <>
                <span className="text-for-400 font-bold">{series.blue_wins}</span>
                <span className="text-surface-600">–</span>
                <span className="text-against-400 font-bold">{series.red_wins}</span>
                <span className="text-surface-500 ml-0.5">
                  ({series.format.replace('best_of_', 'Bo').replace('fixed', 'Fixed')})
                </span>
              </>
            )}
            <span className="text-surface-600">→</span>
          </div>
        </Link>
      )}

      {/* Split arena */}
      <div className="absolute inset-0 pt-32 pb-36 z-10 flex">
        <button
          type="button"
          onClick={() => handleArenaTap('blue')}
          className="flex-1 relative cursor-pointer focus:outline-none"
          aria-label="Tap to react on FOR side"
        >
          <DebateSide
            side="blue"
            speaker={blueSpeaker}
            isActive={isLive && debate.phase !== 'ended'}
            argument={null}
            onApplause={() => handleApplause('blue')}
          />
        </button>
        <button
          type="button"
          onClick={() => handleArenaTap('red')}
          className="flex-1 relative cursor-pointer focus:outline-none"
          aria-label="Tap to react on AGAINST side"
        >
          <DebateSide
            side="red"
            speaker={redSpeaker}
            isActive={isLive && debate.phase !== 'ended'}
            argument={null}
            onApplause={() => handleApplause('red')}
          />
        </button>
      </div>

      {/* Floating reactions */}
      <DebateReactions reactions={reactions} onExpire={handleReactionExpire} />

      {/* Bottom: audience vote pulse + reaction trigger */}
      <div className="absolute bottom-0 left-0 right-0 z-30 pb-4">
        <AudienceVotePulse
          blueSway={debate.blue_sway}
          redSway={debate.red_sway}
        />
        <div className="flex items-center justify-between px-6 pt-2">
          <ReactionTrigger side={null} onReact={handleSendReaction} />
          <div className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">
            Tap a side to react
          </div>
        </div>
      </div>

      {/* Chat panel */}
      <ErrorBoundary size="sm" label="Chat unavailable">
        <DebateChat
          debateId={debate.id}
          messages={messages}
          currentUserId={currentUserId}
          isOpen={chatOpen}
          onToggle={() => setChatOpen((v) => !v)}
          onSend={handleSendMessage}
        />
      </ErrorBoundary>

      {/* Not live overlay */}
      {!isLive && debate.status !== 'ended' && (
        <div className={cn('absolute inset-x-0 top-36 z-20 flex flex-col items-center gap-3')}>
          <div className="inline-block px-4 py-2 rounded-full bg-surface-100/90 backdrop-blur-md border border-surface-300">
            <span className="font-mono text-xs text-surface-600 uppercase tracking-widest">
              {debate.status === 'scheduled'
                ? `Scheduled for ${new Date(debate.scheduled_at).toLocaleString(
                    'en-US',
                    {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    }
                  )}`
                : debate.status}
            </span>
          </div>
          {debate.status === 'scheduled' && (
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <CalendarExportButton debateId={debate.id} size="md" />
              <DebateRSVPButton
                debateId={debate.id}
                size="md"
                className="backdrop-blur-md bg-surface-100/80"
              />
              {currentUserId && participants.some((p) => p.user_id === currentUserId && p.is_speaker) && (
                <Link href={`/debate/${debate.id}/coach`}>
                  <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-purple/10 backdrop-blur-md border border-purple/30 text-sm font-semibold text-purple hover:bg-purple/20 hover:border-purple/50 transition-all">
                    <Bot className="h-3.5 w-3.5" />
                    Get Coached
                  </button>
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Ended overlay — shows recap CTA */}
      {debate.status === 'ended' && (
        <div className="absolute inset-x-0 top-36 z-20 flex flex-col items-center gap-4 px-4">
          <div className="flex flex-col items-center gap-1">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-100/90 backdrop-blur-md border border-surface-300">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex h-2 w-2 rounded-full bg-surface-500" />
              </span>
              <span className="font-mono text-xs text-surface-500 uppercase tracking-widest">
                Debate ended
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 font-mono text-sm">
              <span className="text-for-400 font-bold">{debate.blue_sway}% FOR</span>
              <span className="text-surface-600">·</span>
              <span className="text-against-400 font-bold">{debate.red_sway}% AGAINST</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/debate/${debate.id}/clash`}>
              <button className="px-6 py-2.5 rounded-full bg-for-600/10 backdrop-blur-md border border-for-500/30 text-sm font-semibold text-for-400 hover:bg-for-600/20 hover:border-for-500/50 transition-all">
                Clash
              </button>
            </Link>
            <Link href={`/debate/${debate.id}/verdict`}>
              <button className="px-6 py-2.5 rounded-full bg-gold/10 backdrop-blur-md border border-gold/30 text-sm font-semibold text-gold hover:bg-gold/20 hover:border-gold/50 transition-all">
                Verdict
              </button>
            </Link>
            <Link href={`/debate/${debate.id}/recap`}>
              <button className="px-6 py-2.5 rounded-full bg-surface-100/90 backdrop-blur-md border border-surface-300 text-sm font-semibold text-white hover:bg-surface-200/90 hover:border-surface-400 transition-all">
                View Recap
              </button>
            </Link>
            <Link href={`/debate/${debate.id}/audience`}>
              <button className="px-6 py-2.5 rounded-full bg-purple/10 backdrop-blur-md border border-purple/30 text-sm font-semibold text-purple hover:bg-purple/20 hover:border-purple/50 transition-all">
                Audience
              </button>
            </Link>
            <Link href={`/debate/${debate.id}/performance`}>
              <button className="px-6 py-2.5 rounded-full bg-surface-100/90 backdrop-blur-md border border-surface-300 text-sm font-semibold text-surface-400 hover:text-white hover:bg-surface-200/90 hover:border-surface-400 transition-all">
                Stats
              </button>
            </Link>
            <Link href={`/debate/${debate.id}/highlights`}>
              <button className="px-6 py-2.5 rounded-full bg-surface-100/90 backdrop-blur-md border border-surface-300 text-sm font-semibold text-surface-400 hover:text-white hover:bg-surface-200/90 hover:border-surface-400 transition-all">
                Highlights
              </button>
            </Link>
            <Link href={`/debate/${debate.id}/predictions`}>
              <button className="px-6 py-2.5 rounded-full bg-purple/10 backdrop-blur-md border border-purple/30 text-sm font-semibold text-purple hover:bg-purple/20 hover:border-purple/50 transition-all">
                Predictions
              </button>
            </Link>
            <Link href={`/debate/${debate.id}/replay`}>
              <button className="px-6 py-2.5 rounded-full bg-purple/10 backdrop-blur-md border border-purple/30 text-sm font-semibold text-purple hover:bg-purple/20 hover:border-purple/50 transition-all">
                Replay
              </button>
            </Link>
            <Link href={`/debate/${debate.id}/transcript`}>
              <button className="px-6 py-2.5 rounded-full bg-surface-100/90 backdrop-blur-md border border-surface-300 text-sm font-semibold text-surface-400 hover:text-white hover:bg-surface-200/90 hover:border-surface-400 transition-all">
                Transcript
              </button>
            </Link>
            <Link href={`/debate/${debate.id}/analysis`}>
              <button className="px-6 py-2.5 rounded-full bg-purple/10 backdrop-blur-md border border-purple/30 text-sm font-semibold text-purple hover:bg-purple/20 hover:border-purple/50 transition-all">
                AI Analysis
              </button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
