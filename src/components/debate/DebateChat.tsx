'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, X, MessageSquare } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type { DebateMessageWithAuthor, VoteSide } from '@/lib/supabase/types'

interface DebateChatProps {
  debateId: string
  messages: DebateMessageWithAuthor[]
  currentUserId: string | null
  isOpen: boolean
  onToggle: () => void
  onSend: (content: string, side: VoteSide | null) => Promise<void>
}

const MAX_CHARS = 500
const RATE_LIMIT_MS = 1500

type SideSelection = VoteSide | 'neutral'

const SIDE_OPTIONS: Array<{ value: SideSelection; label: string }> = [
  { value: 'blue', label: 'AGREE' },
  { value: 'neutral', label: 'NEUTRAL' },
  { value: 'red', label: 'DISAGREE' },
]

export function DebateChat({
  messages,
  currentUserId,
  isOpen,
  onToggle,
  onSend,
}: DebateChatProps) {
  const [input, setInput] = useState('')
  const [sideSelection, setSideSelection] = useState<SideSelection>('neutral')
  const [sending, setSending] = useState(false)
  const [lastSentAt, setLastSentAt] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!isOpen) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || sending) return
    if (!currentUserId) {
      setError('Sign in to chat')
      return
    }
    const now = Date.now()
    if (now - lastSentAt < RATE_LIMIT_MS) {
      setError('Slow down a bit')
      return
    }
    if (trimmed.length > MAX_CHARS) return

    setSending(true)
    setError(null)
    try {
      const side: VoteSide | null =
        sideSelection === 'neutral' ? null : sideSelection
      await onSend(trimmed, side)
      setInput('')
      setLastSentAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {/* Toggle button (visible when closed) */}
      {!isOpen && (
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'fixed right-4 bottom-20 z-40 h-12 w-12 rounded-full',
            'bg-surface-100/90 backdrop-blur-md border border-surface-300',
            'flex items-center justify-center text-white',
            'hover:bg-surface-200 transition-colors'
          )}
          aria-label="Open chat"
        >
          <MessageSquare className="h-5 w-5" />
          {messages.length > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-for-600 text-white text-[10px] font-mono px-1 flex items-center justify-center">
              {messages.length}
            </span>
          )}
        </button>
      )}

      {/* Sliding panel */}
      <aside
        className={cn(
          'fixed top-0 right-0 h-full z-40 transition-transform duration-300 ease-out',
          'w-full sm:w-96 max-w-full',
          'bg-surface-100/95 backdrop-blur-xl border-l border-surface-300 flex flex-col',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-surface-300 flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-surface-600" />
            <span className="font-mono text-sm font-semibold text-white">
              Live Chat
            </span>
            <span className="text-[11px] font-mono text-surface-500">
              · {messages.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex items-center justify-center"
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-3 py-3 space-y-2"
        >
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-xs font-mono text-surface-500">
              Be the first to say something.
            </div>
          )}
          {messages.map((msg) => {
            const isBlue = msg.side === 'blue'
            const isRed = msg.side === 'red'
            const align = isRed
              ? 'self-end text-right'
              : isBlue
                ? 'self-start'
                : 'self-center'
            const bubble = isBlue
              ? 'bg-for-500/10 border-for-500/30 text-for-100'
              : isRed
                ? 'bg-against-500/10 border-against-500/30 text-against-100'
                : 'bg-surface-200 border-surface-300 text-surface-700'

            return (
              <div
                key={msg.id}
                className={cn('flex flex-col w-full', align, 'items-stretch')}
              >
                <div className="flex items-start gap-2">
                  <Avatar
                    src={msg.author?.avatar_url}
                    fallback={
                      msg.author?.display_name ??
                      msg.author?.username ??
                      'User'
                    }
                    size="sm"
                    className="flex-shrink-0 h-7 w-7"
                  />
                  <div
                    className={cn(
                      'flex-1 min-w-0 rounded-xl px-3 py-2 border',
                      bubble
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-mono text-[11px] font-semibold truncate">
                        @{msg.author?.username ?? 'user'}
                      </span>
                      <span className="text-[10px] font-mono text-surface-500">
                        {new Date(msg.created_at).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-[13px] leading-snug whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="flex-shrink-0 border-t border-surface-300 p-3 space-y-2 bg-surface-100/80"
        >
          {/* Side selector */}
          <div className="flex gap-1">
            {SIDE_OPTIONS.map((opt) => {
              const selected = sideSelection === opt.value
              const tint =
                opt.value === 'blue'
                  ? 'for'
                  : opt.value === 'red'
                    ? 'against'
                    : 'surface'
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSideSelection(opt.value)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider border transition-colors',
                    selected
                      ? tint === 'for'
                        ? 'bg-for-500/20 border-for-500 text-for-300'
                        : tint === 'against'
                          ? 'bg-against-500/20 border-against-500 text-against-300'
                          : 'bg-surface-300 border-surface-400 text-white'
                      : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white'
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>

          {error && (
            <p className="text-[11px] font-mono text-against-400">{error}</p>
          )}

          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value.slice(0, MAX_CHARS))
                if (error) setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e as unknown as React.FormEvent)
                }
              }}
              rows={2}
              placeholder={
                currentUserId ? 'Say something...' : 'Sign in to chat'
              }
              disabled={!currentUserId || sending}
              className={cn(
                'flex-1 resize-none rounded-lg px-3 py-2 text-sm',
                'bg-surface-200 border border-surface-300 text-white placeholder:text-surface-500',
                'focus:outline-none focus:border-for-500/50 focus:ring-1 focus:ring-for-500/20 transition-colors'
              )}
            />
            <button
              type="submit"
              disabled={!input.trim() || sending || !currentUserId}
              className={cn(
                'flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center transition-colors',
                'bg-for-600 text-white hover:bg-for-700',
                'disabled:opacity-40 disabled:pointer-events-none'
              )}
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <div className="text-[10px] font-mono text-surface-500 text-right">
            {input.length}/{MAX_CHARS}
          </div>
        </form>
      </aside>
    </>
  )
}
