'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare,
  Send,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ChatMessage, ChatResponse } from '@/app/api/topic-chat/[topicId]/route'

// ─── Role styles ──────────────────────────────────────────────────────────────

const ROLE_STYLE: Record<string, string> = {
  elder:         'text-gold',
  senator:       'text-purple',
  lawmaker:      'text-gold',
  debator:       'text-for-400',
  troll_catcher: 'text-emerald',
  person:        'text-surface-400',
}

const ROLE_LABEL: Record<string, string> = {
  elder:         'Elder',
  senator:       'Senator',
  lawmaker:      'Lawmaker',
  debator:       'Debator',
  troll_catcher: 'Troll Catcher',
  person:        'Citizen',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (s < 60) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Message row ──────────────────────────────────────────────────────────────

function MessageRow({
  msg,
  isOwn,
  onDelete,
}: {
  msg: ChatMessage
  isOwn: boolean
  onDelete: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const author = msg.author
  const displayName = author?.display_name ?? author?.username ?? 'Unknown'
  const role = author?.role ?? 'person'

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    onDelete(msg.id)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'group flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-200/40 transition-colors',
        isOwn && 'flex-row-reverse'
      )}
    >
      {/* Avatar */}
      <Avatar
        src={author?.avatar_url}
        fallback={displayName}
        size="xs"
        className="flex-shrink-0 mt-0.5"
      />

      <div className={cn('flex flex-col gap-0.5 max-w-[80%]', isOwn && 'items-end')}>
        {/* Header */}
        <div className={cn('flex items-center gap-1.5', isOwn && 'flex-row-reverse')}>
          <span className="font-mono text-xs font-semibold text-white truncate max-w-[120px]">
            {displayName}
          </span>
          <span className={cn('font-mono text-[10px] font-medium', ROLE_STYLE[role] ?? 'text-surface-400')}>
            {ROLE_LABEL[role] ?? role}
          </span>
          <span className="font-mono text-[10px] text-surface-600">
            {relativeTime(msg.created_at)}
          </span>
        </div>

        {/* Bubble */}
        <div
          className={cn(
            'relative inline-block rounded-xl px-3 py-1.5 text-sm font-mono',
            isOwn
              ? 'bg-for-600/30 text-for-100 rounded-tr-sm border border-for-500/20'
              : 'bg-surface-200 text-surface-800 rounded-tl-sm border border-surface-300'
          )}
        >
          <span className="break-words whitespace-pre-wrap leading-relaxed">{msg.content}</span>
          {isOwn && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 rounded-full bg-against-600/80 border border-against-500/50 flex items-center justify-center hover:bg-against-500"
              title="Delete message"
            >
              {deleting ? (
                <Loader2 className="h-2.5 w-2.5 text-white animate-spin" />
              ) : (
                <X className="h-2.5 w-2.5 text-white" />
              )}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── TopicChat ────────────────────────────────────────────────────────────────

interface TopicChatProps {
  topicId: string
}

const MAX_CHARS = 300
const POLL_INTERVAL_MS = 8_000

export function TopicChat({ topicId }: TopicChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const latestTimestampRef = useRef<string | null>(null)

  const scrollToBottom = (smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' })
  }

  const fetchMessages = useCallback(async (initial = false) => {
    try {
      const res = await fetch(`/api/topic-chat/${topicId}`)
      if (!res.ok) throw new Error('Failed to load chat')
      const data: ChatResponse = await res.json()

      setCurrentUserId(data.currentUserId)
      setMessages(data.messages)

      if (data.messages.length > 0) {
        latestTimestampRef.current = data.messages[data.messages.length - 1].created_at
      }

      if (initial) {
        setTimeout(() => scrollToBottom(false), 50)
      } else {
        setTimeout(() => scrollToBottom(), 50)
      }
    } catch {
      if (initial) setError('Failed to load chat messages')
    } finally {
      if (initial) setLoading(false)
    }
  }, [topicId])

  // Initial load
  useEffect(() => {
    fetchMessages(true)
  }, [fetchMessages])

  // Supabase Realtime for new messages
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`topic-chat-${topicId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'topic_chat_messages',
          filter: `topic_id=eq.${topicId}`,
        },
        () => {
          fetchMessages()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'topic_chat_messages',
          filter: `topic_id=eq.${topicId}`,
        },
        () => {
          fetchMessages()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [topicId, fetchMessages])

  // Fallback polling (in case realtime isn't available)
  useEffect(() => {
    pollRef.current = setInterval(() => fetchMessages(), POLL_INTERVAL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchMessages])

  const handleDelete = useCallback(async (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
    try {
      await fetch(`/api/topic-chat/${topicId}?messageId=${messageId}`, {
        method: 'DELETE',
      })
    } catch {
      // Re-fetch on failure
      fetchMessages()
    }
  }, [topicId, fetchMessages])

  const handleSend = async () => {
    const content = draft.trim()
    if (!content || sending) return
    setSendError(null)
    setSending(true)

    try {
      const res = await fetch(`/api/topic-chat/${topicId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const json = await res.json()
      if (!res.ok) {
        setSendError(json.error ?? 'Failed to send message')
        return
      }
      setDraft('')
      textareaRef.current?.focus()
    } catch {
      setSendError('Network error. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const remaining = MAX_CHARS - draft.length
  const isOverLimit = remaining < 0
  const isNearLimit = remaining <= 40 && remaining >= 0

  if (loading) {
    return (
      <div className="flex flex-col gap-3 py-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={cn('flex items-start gap-2.5 px-3', i % 2 === 1 && 'flex-row-reverse')}>
            <div className="h-6 w-6 rounded-full bg-surface-300 animate-pulse flex-shrink-0" />
            <div className="flex flex-col gap-1" style={{ alignItems: i % 2 === 1 ? 'flex-end' : 'flex-start' }}>
              <div className="h-2.5 w-20 rounded bg-surface-300 animate-pulse" />
              <div className="h-7 rounded-xl bg-surface-300 animate-pulse" style={{ width: `${80 + i * 20}px` }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm font-mono text-against-400">{error}</p>
        <button
          type="button"
          onClick={() => { setError(null); setLoading(true); fetchMessages(true) }}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-white transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse" />
          <span className="font-mono text-xs text-surface-500">
            {messages.length === 0
              ? 'No messages yet — start the conversation'
              : `${messages.length} message${messages.length !== 1 ? 's' : ''}`}
          </span>
        </div>
        <button
          type="button"
          onClick={() => fetchMessages()}
          className="text-surface-600 hover:text-white transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Messages scroll area */}
      <div className="min-h-[200px] max-h-[400px] overflow-y-auto rounded-xl bg-surface-100 border border-surface-300 py-2 mb-3">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[180px]">
            <EmptyState
              icon={MessageSquare}
              title="No messages yet"
              description="Be the first to share a quick thought on this topic."
              size="sm"
            />
          </div>
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            {messages.map((msg) => (
              <MessageRow
                key={msg.id}
                msg={msg}
                isOwn={msg.user_id === currentUserId}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {currentUserId ? (
        <div className="space-y-1.5">
          {sendError && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-mono text-against-400 px-1"
            >
              {sendError}
            </motion.p>
          )}
          <div className={cn(
            'flex gap-2 items-end rounded-xl border bg-surface-100 p-2 transition-colors',
            isOverLimit ? 'border-against-500/50' : 'border-surface-300 focus-within:border-surface-400'
          )}>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                setSendError(null)
              }}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Share a quick thought… (Enter to send, Shift+Enter for newline)"
              className="flex-1 bg-transparent resize-none outline-none text-sm font-mono text-white placeholder:text-surface-600 leading-relaxed"
            />
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <span className={cn(
                'font-mono text-[10px] tabular-nums',
                isOverLimit ? 'text-against-400' : isNearLimit ? 'text-gold' : 'text-surface-600'
              )}>
                {remaining}
              </span>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !draft.trim() || isOverLimit}
                className={cn(
                  'h-7 w-7 rounded-lg flex items-center justify-center transition-all',
                  draft.trim() && !isOverLimit && !sending
                    ? 'bg-for-500 hover:bg-for-400 text-white shadow-sm shadow-for-700/30'
                    : 'bg-surface-300 text-surface-600 cursor-not-allowed'
                )}
              >
                {sending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
          <p className="text-[10px] font-mono text-surface-600 px-1">
            Ephemeral chat — for quick reactions, not structured arguments. Keep it civil.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 text-center">
          <p className="text-sm font-mono text-surface-500">
            <a href="/login" className="text-for-400 hover:text-for-300 underline underline-offset-2">
              Sign in
            </a>{' '}
            to join the conversation
          </p>
        </div>
      )}
    </div>
  )
}
