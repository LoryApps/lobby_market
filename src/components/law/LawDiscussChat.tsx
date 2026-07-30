'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, MessageSquare, RefreshCw, Send, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ChatMessage, ChatResponse } from '@/app/api/law-chat/[lawId]/route'

// ─── Role colours ─────────────────────────────────────────────────────────────

const ROLE_STYLE: Record<string, string> = {
  elder: 'text-gold',
  senator: 'text-purple',
  lawmaker: 'text-gold',
  debator: 'text-for-400',
  troll_catcher: 'text-emerald',
  person: 'text-surface-400',
}

const ROLE_LABEL: Record<string, string> = {
  elder: 'Elder',
  senator: 'Senator',
  lawmaker: 'Lawmaker',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  person: 'Citizen',
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

// ─── MessageRow ───────────────────────────────────────────────────────────────

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
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    setDeleting(true)
    onDelete(msg.id)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      className="flex gap-2.5 group"
    >
      <Avatar
        src={msg.author.avatar_url}
        fallback={msg.author.display_name || msg.author.username}
        size="sm"
        className="flex-shrink-0 mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-white truncate">
            {msg.author.display_name || msg.author.username}
          </span>
          <span
            className={cn(
              'text-[10px] font-mono uppercase tracking-wide',
              ROLE_STYLE[msg.author.role] ?? 'text-surface-500'
            )}
          >
            {ROLE_LABEL[msg.author.role] ?? msg.author.role}
          </span>
          <span className="text-[10px] text-surface-500">{relativeTime(msg.created_at)}</span>
        </div>
        <p className="text-sm text-surface-200 mt-0.5 leading-relaxed break-words">{msg.content}</p>
      </div>

      {isOwn && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          aria-label="Delete message"
          className={cn(
            'flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity',
            'p-1 rounded text-surface-500 hover:text-against-400',
            confirmDelete && 'opacity-100 text-against-400'
          )}
        >
          {deleting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : confirmDelete ? (
            <X className="h-3 w-3" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
        </button>
      )}
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface LawDiscussChatProps {
  lawId: string
}

export function LawDiscussChat({ lawId }: LawDiscussChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const MAX = 300

  // Get current user
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/law-chat/${lawId}`)
      if (!res.ok) throw new Error('Failed to load')
      const data: ChatResponse = await res.json()
      setMessages(data.messages)
      setTotal(data.total)
    } catch {
      setError('Could not load discussion. Try refreshing.')
    } finally {
      setLoading(false)
    }
  }, [lawId])

  useEffect(() => {
    load()
    // Poll every 15s for new messages
    const interval = setInterval(load, 15_000)
    return () => clearInterval(interval)
  }, [load])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (!loading) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading])

  async function send() {
    const content = draft.trim()
    if (!content || content.length > MAX || sending) return
    setSending(true)
    setDraft('')
    try {
      const res = await fetch(`/api/law-chat/${lawId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to send')
      }
      const newMsg: ChatMessage = await res.json()
      setMessages((prev) => [...prev, newMsg])
      setTotal((t) => t + 1)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (e) {
      setDraft(content) // restore draft on failure
      setError((e as Error).message)
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  function deleteMessage(id: string) {
    setMessages((prev) => prev.filter((m) => m.id !== id))
    setTotal((t) => Math.max(0, t - 1))
    fetch(`/api/law-chat/${lawId}?id=${id}`, { method: 'DELETE' }).catch(() => {
      // Best-effort; reload will restore if delete failed
      load()
    })
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const remaining = MAX - draft.length
  const isNearLimit = remaining <= 50
  const isOverLimit = remaining < 0

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-300/50 flex-shrink-0">
        <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider">
          <MessageSquare className="h-3.5 w-3.5 text-gold" />
          Discuss
          {total > 0 && (
            <span className="text-surface-600">· {total} message{total !== 1 ? 's' : ''}</span>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          aria-label="Refresh discussion"
          className="p-1 rounded text-surface-500 hover:text-surface-300 transition-colors"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
        {loading && messages.length === 0 ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-2.5">
                <div className="h-7 w-7 rounded-full bg-surface-300/50 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-2.5 w-24 bg-surface-300/50 rounded animate-pulse" />
                  <div className="h-3 w-full bg-surface-300/40 rounded animate-pulse" />
                  <div className="h-3 w-3/4 bg-surface-300/30 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm text-against-400">{error}</p>
            <button
              onClick={load}
              className="text-xs font-mono text-for-400 hover:text-for-300 underline"
            >
              Try again
            </button>
          </div>
        ) : messages.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Start the discussion"
            description="Be the first to share your thoughts on this law's implications."
          />
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <MessageRow
                key={msg.id}
                msg={msg}
                isOwn={msg.user_id === userId}
                onDelete={deleteMessage}
              />
            ))}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      {userId ? (
        <div className="flex-shrink-0 border-t border-surface-300/50 px-4 py-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Share your thoughts on this law… (Enter to send)"
                rows={2}
                maxLength={MAX + 10}
                aria-label="Discussion message"
                className={cn(
                  'w-full resize-none rounded-xl bg-surface-200 border text-sm text-white',
                  'placeholder:text-surface-500 px-3 py-2.5 pr-12 focus:outline-none',
                  'transition-colors leading-relaxed',
                  isOverLimit
                    ? 'border-against-500/60 focus:border-against-400'
                    : 'border-surface-300/50 focus:border-surface-400/60'
                )}
              />
              {draft.length > 0 && (
                <span
                  className={cn(
                    'absolute bottom-2.5 right-3 text-[10px] font-mono',
                    isOverLimit
                      ? 'text-against-400'
                      : isNearLimit
                        ? 'text-gold'
                        : 'text-surface-500'
                  )}
                >
                  {remaining}
                </span>
              )}
            </div>
            <button
              onClick={send}
              disabled={!draft.trim() || isOverLimit || sending}
              aria-label="Send message"
              className={cn(
                'flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl',
                'transition-all font-mono text-sm',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                draft.trim() && !isOverLimit
                  ? 'bg-gold text-surface-50 hover:bg-gold/80'
                  : 'bg-surface-200 border border-surface-300/50 text-surface-500'
              )}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="text-[10px] font-mono text-surface-600 mt-1.5">
            Press Enter to send · Shift+Enter for a new line · Keep it civil
          </p>
        </div>
      ) : (
        <div className="flex-shrink-0 border-t border-surface-300/50 px-4 py-3">
          <p className="text-xs text-surface-500 text-center font-mono">
            <a href="/sign-in" className="text-for-400 hover:text-for-300 underline">
              Sign in
            </a>{' '}
            to join the discussion
          </p>
        </div>
      )}
    </div>
  )
}
