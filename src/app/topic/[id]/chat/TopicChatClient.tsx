'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Loader2,
  MessageCircle,
  Send,
  Trash2,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { VoteBar } from '@/components/voting/VoteBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ChatMessage } from '@/app/api/topic-chat/[topicId]/route'
import type { Topic } from '@/lib/supabase/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_CHARS = 300

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  isSelf,
  onDelete,
}: {
  msg: ChatMessage
  isSelf: boolean
  onDelete: (id: string) => void
}) {
  const [showDelete, setShowDelete] = useState(false)
  const name = msg.author?.display_name ?? msg.author?.username ?? 'Unknown'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'flex items-end gap-2 group',
        isSelf ? 'flex-row-reverse' : 'flex-row'
      )}
      onMouseEnter={() => isSelf && setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      {/* Avatar */}
      {!isSelf && (
        <Link href={`/profile/${msg.author?.username}`} className="flex-shrink-0 mb-1">
          <Avatar
            src={msg.author?.avatar_url ?? null}
            username={msg.author?.username ?? '?'}
            size="xs"
          />
        </Link>
      )}

      <div className={cn('flex flex-col max-w-[72%]', isSelf ? 'items-end' : 'items-start')}>
        {/* Name + time */}
        {!isSelf && (
          <div className="flex items-center gap-1.5 mb-1 px-1">
            <span className="text-xs font-mono font-semibold text-surface-300 truncate max-w-[120px]">
              {name}
            </span>
            <span className="text-[10px] font-mono text-surface-600">
              {relTime(msg.created_at)}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          {/* Delete button — own messages only */}
          {isSelf && showDelete && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => onDelete(msg.id)}
              className="flex-shrink-0 p-1 rounded text-surface-600 hover:text-against-400 transition-colors"
              aria-label="Delete message"
            >
              <Trash2 className="h-3 w-3" />
            </motion.button>
          )}

          {/* Bubble */}
          <div
            className={cn(
              'px-3 py-2 rounded-2xl text-sm font-mono leading-relaxed break-words',
              isSelf
                ? 'bg-surface-200 border border-surface-300 text-white rounded-br-sm'
                : 'bg-surface-100 border border-surface-300 text-surface-200 rounded-bl-sm'
            )}
          >
            {msg.content}
          </div>
        </div>

        {/* Time for own messages */}
        {isSelf && (
          <span className="text-[10px] font-mono text-surface-600 mt-1 px-1">
            {relTime(msg.created_at)}
          </span>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TopicChatClientProps {
  topic: Topic
  initialMessages: ChatMessage[]
  currentUserId: string | null
}

export function TopicChatClient({
  topic,
  initialMessages,
  currentUserId,
}: TopicChatClientProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [onlineCount, setOnlineCount] = useState(1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const seenRef = useRef(new Set(initialMessages.map((m) => m.id)))

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages])

  // Supabase Realtime: subscribe to new chat messages for this topic
  useEffect(() => {
    const supabase = createClient()

    // Presence channel for online count
    const presenceChannel = supabase.channel(`chat-presence:${topic.id}`, {
      config: { presence: { key: currentUserId ?? 'anon' } },
    })

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        setOnlineCount(Math.max(1, Object.keys(state).length))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && currentUserId) {
          await presenceChannel.track({ user_id: currentUserId, joined_at: Date.now() })
        }
      })

    // Messages channel
    const msgChannel = supabase
      .channel(`chat-messages:${topic.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'topic_chat_messages',
          filter: `topic_id=eq.${topic.id}`,
        },
        (payload) => {
          const raw = payload.new as {
            id: string
            topic_id: string
            user_id: string
            content: string
            created_at: string
          }

          if (seenRef.current.has(raw.id)) return
          seenRef.current.add(raw.id)

          // Fetch author profile separately (postgres_changes doesn't return joins)
          supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url, role')
            .eq('id', raw.user_id)
            .single()
            .then(({ data: author }) => {
              setMessages((prev) => [
                ...prev,
                {
                  id: raw.id,
                  topic_id: raw.topic_id,
                  user_id: raw.user_id,
                  content: raw.content,
                  created_at: raw.created_at,
                  author: author ?? null,
                },
              ])
            })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'topic_chat_messages',
          filter: `topic_id=eq.${topic.id}`,
        },
        (payload) => {
          const { id } = payload.old as { id: string }
          setMessages((prev) => prev.filter((m) => m.id !== id))
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = msgChannel

    return () => {
      presenceChannel.unsubscribe()
      msgChannel.unsubscribe()
    }
  }, [topic.id, currentUserId])

  const handleSend = useCallback(async () => {
    const content = draft.trim()
    if (!content || sending) return
    if (!currentUserId) {
      setError('Sign in to join the chat')
      return
    }

    setSending(true)
    setError(null)

    try {
      const res = await fetch(`/api/topic-chat/${topic.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      if (!res.ok) {
        const { error: msg } = (await res.json()) as { error: string }
        setError(msg ?? 'Failed to send')
        return
      }

      setDraft('')
      // Message will arrive via realtime subscription
    } catch {
      setError('Failed to send message')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }, [draft, sending, currentUserId, topic.id])

  const handleDelete = useCallback(async (messageId: string) => {
    try {
      await fetch(`/api/topic-chat/${topic.id}?messageId=${messageId}`, {
        method: 'DELETE',
      })
      // Message removal arrives via realtime DELETE event
    } catch {
      // ignore
    }
  }, [topic.id])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const charsLeft = MAX_CHARS - draft.length
  const isOverLimit = charsLeft < 0

  return (
    <div className="flex flex-col h-screen bg-surface-50">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-surface-300 bg-surface-100">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <Link
              href={`/topic/${topic.id}`}
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
              aria-label="Back to topic"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <MessageCircle className="h-4 w-4 text-for-400 flex-shrink-0" />
                <span className="font-mono text-xs font-semibold text-for-400 uppercase tracking-wide">
                  Live Chat
                </span>
                <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
                  {topic.status}
                </Badge>
              </div>
              <p className="text-sm font-mono text-white leading-snug line-clamp-2">
                {topic.statement}
              </p>
            </div>

            <div className="flex-shrink-0 flex flex-col items-end gap-1">
              {/* Connection indicator */}
              <div className={cn(
                'flex items-center gap-1 text-[10px] font-mono',
                connected ? 'text-emerald' : 'text-surface-600'
              )}>
                {connected
                  ? <Wifi className="h-3 w-3" />
                  : <WifiOff className="h-3 w-3" />
                }
                {connected ? 'Live' : 'Connecting…'}
              </div>
              {/* Online count */}
              <div className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
                <Users className="h-3 w-3" />
                {onlineCount} here
              </div>
            </div>
          </div>

          {/* Vote bar */}
          <VoteBar
            bluePct={topic.blue_pct}
            totalVotes={topic.total_votes}
            showLabels
          />
        </div>
      </div>

      {/* ── Messages ────────────────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        <div className="max-w-2xl mx-auto space-y-3">
          {messages.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="No messages yet"
              description="Be the first to say something about this debate."
              className="mt-16"
            />
          ) : (
            <AnimatePresence initial={false} mode="popLayout">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isSelf={msg.user_id === currentUserId}
                  onDelete={handleDelete}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* ── Input bar ────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-surface-300 bg-surface-100 pb-safe">
        <div className="max-w-2xl mx-auto px-4 py-3">
          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-xs font-mono text-against-400 mb-2"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {currentUserId ? (
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value)
                    setError(null)
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Say something… (Enter to send)"
                  rows={1}
                  maxLength={MAX_CHARS + 10}
                  className={cn(
                    'w-full resize-none rounded-xl px-3 py-2.5 pr-12',
                    'bg-surface-200 border text-sm font-mono text-white placeholder-surface-600',
                    'focus:outline-none focus:ring-1 focus:ring-for-500',
                    'transition-colors leading-relaxed',
                    isOverLimit
                      ? 'border-against-500'
                      : 'border-surface-300 focus:border-for-500',
                  )}
                  style={{ minHeight: '44px', maxHeight: '120px' }}
                />
                {/* Char counter */}
                {draft.length > 0 && (
                  <span
                    className={cn(
                      'absolute right-3 bottom-2.5 text-[10px] font-mono tabular-nums',
                      isOverLimit ? 'text-against-400' : 'text-surface-600',
                    )}
                  >
                    {charsLeft}
                  </span>
                )}
              </div>

              <button
                onClick={handleSend}
                disabled={!draft.trim() || isOverLimit || sending}
                className={cn(
                  'flex items-center justify-center h-10 w-10 rounded-xl flex-shrink-0 transition-all',
                  draft.trim() && !isOverLimit && !sending
                    ? 'bg-for-600 hover:bg-for-500 text-white'
                    : 'bg-surface-200 text-surface-600 cursor-not-allowed',
                )}
                aria-label="Send message"
              >
                {sending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />
                }
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-3">
              <MessageCircle className="h-4 w-4 text-surface-600" />
              <span className="text-sm font-mono text-surface-500">
                <Link href="/login" className="text-for-400 hover:text-for-300 transition-colors">
                  Sign in
                </Link>{' '}
                to join the conversation
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
