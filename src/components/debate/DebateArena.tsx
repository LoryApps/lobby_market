'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import type {
  DebateWithTopic,
  DebateParticipantWithProfile,
  DebateMessageWithAuthor,
  VoteSide,
  Debate,
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

  const reactionIdRef = useRef(0)

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
      <DebateChat
        debateId={debate.id}
        messages={messages}
        currentUserId={currentUserId}
        isOpen={chatOpen}
        onToggle={() => setChatOpen((v) => !v)}
        onSend={handleSendMessage}
      />

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
            <DebateRSVPButton
              debateId={debate.id}
              size="md"
              className="backdrop-blur-md bg-surface-100/80"
            />
          )}
        </div>
      )}
    </div>
  )
}
