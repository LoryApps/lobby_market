'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Loader2,
  Send,
  ExternalLink,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { Profile } from '@/lib/supabase/types'

interface RawMessage {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  is_read: boolean
  created_at: string
  sender: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'> | null
}

interface Props {
  partner: Profile
  currentUserId: string
  currentProfile: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'>
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function groupByDate(messages: RawMessage[]): { date: string; messages: RawMessage[] }[] {
  const groups: { date: string; messages: RawMessage[] }[] = []
  let currentDate = ''
  for (const msg of messages) {
    const date = formatDate(msg.created_at)
    if (date !== currentDate) {
      currentDate = date
      groups.push({ date, messages: [] })
    }
    groups[groups.length - 1].messages.push(msg)
  }
  return groups
}

export function ConversationClient({ partner, currentUserId, currentProfile }: Props) {
  const [messages, setMessages] = useState<RawMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Scroll to bottom whenever messages update
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Load initial messages
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/messages/${partner.username}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages ?? [])
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [partner.username])

  useEffect(() => { load() }, [load])
  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  // Realtime subscription for new messages in this thread
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`dm-${[currentUserId, partner.id].sort().join('-')}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `receiver_id=eq.${currentUserId}`,
        },
        (payload) => {
          const row = payload.new as RawMessage
          // Only handle messages in this thread
          if (row.sender_id !== partner.id) return
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev
            return [...prev, { ...row, sender: null }]
          })
          // Mark read
          fetch(`/api/messages/${partner.username}`, {
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' },
          }).catch(() => {})
        }
      )
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [currentUserId, partner.id, partner.username])

  async function handleSend() {
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    setError(null)

    // Optimistic update
    const optimistic: RawMessage = {
      id: `opt-${Date.now()}`,
      sender_id: currentUserId,
      receiver_id: partner.id,
      content,
      is_read: false,
      created_at: new Date().toISOString(),
      sender: currentProfile,
    }
    setMessages((prev) => [...prev, optimistic])
    setDraft('')

    try {
      const res = await fetch(`/api/messages/${partner.username}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error ?? 'Failed to send')
        // Remove optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        setDraft(content)
      } else {
        const { message } = await res.json()
        // Replace optimistic with real message
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? message : m))
        )
      }
    } catch {
      setError('Network error')
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setDraft(content)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const groups = groupByDate(messages)
  const partnerName = partner.display_name ?? partner.username

  return (
    <div className="flex flex-col h-screen bg-surface-50">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-surface-100 border-b border-surface-300 z-10">
        <Link
          href="/messages"
          className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
          aria-label="Back to inbox"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <Link href={`/profile/${partner.username}`} className="flex items-center gap-3 flex-1 min-w-0 group">
          <Avatar
            src={partner.avatar_url}
            fallback={partnerName}
            size="md"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate group-hover:text-for-300 transition-colors">
              {partnerName}
            </p>
            <p className="text-xs text-surface-500">@{partner.username}</p>
          </div>
        </Link>

        <Link
          href={`/profile/${partner.username}`}
          className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
          aria-label="View profile"
          title="View profile"
        >
          <ExternalLink className="h-4 w-4" />
        </Link>
      </header>

      {/* ── Messages ────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={cn('flex gap-2', i % 2 === 0 ? 'justify-start' : 'justify-end')}>
                {i % 2 === 0 && <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />}
                <Skeleton className={cn('h-10 rounded-2xl', i % 2 === 0 ? 'w-48' : 'w-40')} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <EmptyState
            icon={Send}
            title="Start the conversation"
            description={`Send a message to @${partner.username} to get started.`}
          />
        ) : (
          <>
            {groups.map((group) => (
              <div key={group.date}>
                {/* Date separator */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-surface-300" />
                  <p className="text-xs font-mono text-surface-500 flex-shrink-0">{group.date}</p>
                  <div className="flex-1 h-px bg-surface-300" />
                </div>

                <div className="space-y-1.5">
                  {group.messages.map((msg) => {
                    const isMine = msg.sender_id === currentUserId
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn('flex gap-2', isMine ? 'justify-end' : 'justify-start')}
                      >
                        {!isMine && (
                          <Avatar
                            src={partner.avatar_url}
                            fallback={partnerName}
                            size="sm"
                            className="flex-shrink-0 mt-auto"
                          />
                        )}
                        <div className={cn('max-w-[75%] space-y-0.5', isMine && 'items-end flex flex-col')}>
                          <div
                            className={cn(
                              'px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words',
                              isMine
                                ? 'bg-for-600 text-white rounded-br-sm'
                                : 'bg-surface-200 text-surface-100 rounded-bl-sm'
                            )}
                          >
                            {msg.content}
                          </div>
                          <p className="text-[10px] text-surface-500 px-1">{formatTime(msg.created_at)}</p>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            ))}
          </>
        )}
        <div ref={bottomRef} />
      </main>

      {/* ── Composer ────────────────────────────────────────────────────────── */}
      <footer className="flex-shrink-0 border-t border-surface-300 bg-surface-100 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {error && (
          <p className="text-xs text-against-400 font-mono mb-2">{error}</p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message @${partner.username}…`}
            maxLength={1000}
            rows={1}
            disabled={sending}
            className={cn(
              'flex-1 resize-none rounded-xl px-4 py-2.5 text-sm',
              'bg-surface-200 border border-surface-300 text-white placeholder:text-surface-500',
              'focus:outline-none focus:border-for-500/50 focus:bg-surface-200',
              'transition-colors disabled:opacity-60',
              'min-h-[42px] max-h-32 overflow-y-auto'
            )}
            style={{ height: 'auto' }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${Math.min(el.scrollHeight, 128)}px`
            }}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            aria-label="Send message"
            className="flex-shrink-0 h-[42px] w-[42px] p-0 flex items-center justify-center rounded-xl"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        {draft.length > 800 && (
          <p className="text-xs text-surface-500 font-mono mt-1 text-right">
            {1000 - draft.length} chars remaining
          </p>
        )}
      </footer>
    </div>
  )
}
