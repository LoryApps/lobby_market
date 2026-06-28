'use client'

/**
 * /counsel — The Civic Counsel
 *
 * An AI-powered civic assistant that answers questions about ongoing
 * debates, established laws, and community consensus on Lobby Market.
 *
 * Uses real platform data as context — the Counsel is grounded in actual
 * topics, votes, arguments, and laws from the Lobby.
 *
 * Distinct from:
 *   /oracle    — predicts which topics become law (not conversational)
 *   /advisor   — recommends which topics to engage (not conversational)
 *   /brief     — daily briefing (not conversational)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUp,
  Bot,
  ChevronRight,
  Gavel,
  Landmark,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  User,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant'
  content: string
  id: string
}

// ─── Suggested questions ──────────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  {
    label: 'What topics are closest to becoming law?',
    icon: Gavel,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
  },
  {
    label: 'What are the most contested debates right now?',
    icon: Scale,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
  },
  {
    label: 'What has the community agreed on?',
    icon: ThumbsUp,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
  },
  {
    label: 'Which economic policy debates are active?',
    icon: TrendingUp,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
  },
  {
    label: 'What are the strongest arguments against AI regulation?',
    icon: ThumbsDown,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
  },
  {
    label: 'How does the voting system work?',
    icon: Zap,
    color: 'text-surface-500',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
  },
]

// ─── Message renderer ─────────────────────────────────────────────────────────

function renderMessageText(text: string) {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    if (line.startsWith('• ') || line.startsWith('- ')) {
      return (
        <li key={i} className="ml-4 list-disc text-surface-700 leading-relaxed">
          {line.slice(2)}
        </li>
      )
    }
    if (line.startsWith('**') && line.endsWith('**')) {
      return (
        <p key={i} className="font-semibold text-white mt-2">
          {line.slice(2, -2)}
        </p>
      )
    }
    if (line === '') {
      return <div key={i} className="h-2" />
    }
    return (
      <p key={i} className="text-surface-700 leading-relaxed">
        {line}
      </p>
    )
  })
}

function AssistantMessage({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="flex-shrink-0 mt-0.5 h-8 w-8 rounded-full bg-purple/20 border border-purple/30 flex items-center justify-center">
        <Bot className="h-4 w-4 text-purple" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0 rounded-2xl rounded-tl-sm bg-surface-100 border border-surface-300 p-4 text-sm space-y-1">
        {renderMessageText(content)}
        {isStreaming && (
          <span className="inline-block h-4 w-0.5 bg-purple animate-pulse ml-0.5 align-middle" />
        )}
      </div>
    </div>
  )
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex gap-3 items-start justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-for-600 px-4 py-3 text-sm text-white leading-relaxed">
        {content}
      </div>
      <div className="flex-shrink-0 mt-0.5 h-8 w-8 rounded-full bg-for-500/20 border border-for-500/30 flex items-center justify-center">
        <User className="h-4 w-4 text-for-400" aria-hidden="true" />
      </div>
    </div>
  )
}

// ─── Welcome screen ───────────────────────────────────────────────────────────

function WelcomeScreen({ onQuestion }: { onQuestion: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center py-8 px-4 text-center">
      {/* Icon */}
      <div className="relative mb-5">
        <div className="h-16 w-16 rounded-2xl bg-purple/15 border border-purple/30 flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-purple" aria-hidden="true" />
        </div>
        <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-for-500/20 border border-for-500/40 flex items-center justify-center">
          <MessageSquare className="h-2.5 w-2.5 text-for-400" />
        </div>
      </div>

      <h2 className="text-xl font-mono font-bold text-white mb-2">The Civic Counsel</h2>
      <p className="text-sm text-surface-500 max-w-sm leading-relaxed mb-8">
        Ask me anything about the Lobby&apos;s debates, established laws, community
        consensus, or how the platform works. I&apos;m grounded in real platform data.
      </p>

      {/* Suggested questions */}
      <div className="w-full max-w-lg grid grid-cols-1 sm:grid-cols-2 gap-2">
        {SUGGESTED_QUESTIONS.map((q) => {
          const Icon = q.icon
          return (
            <button
              key={q.label}
              type="button"
              onClick={() => onQuestion(q.label)}
              className={cn(
                'flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-left',
                'border transition-all duration-200',
                'hover:brightness-110 active:scale-[0.98]',
                q.bg,
                q.border,
              )}
            >
              <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', q.color)} aria-hidden="true" />
              <span className={cn('text-xs font-mono leading-snug', q.color)}>
                {q.label}
              </span>
              <ChevronRight className={cn('h-3 w-3 flex-shrink-0 ml-auto', q.color)} aria-hidden="true" />
            </button>
          )
        })}
      </div>

      {/* Disclaimer */}
      <p className="mt-8 text-[11px] font-mono text-surface-600 max-w-xs leading-relaxed">
        Counsel draws from live Lobby data but may not reflect every topic or recent vote.
        Always verify positions by visiting the topic directly.
      </p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CounselClient() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamingId, setStreamingId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming) return

    setError(null)
    setInput('')

    const userMsg: Message = { role: 'user', content: trimmed, id: crypto.randomUUID() }
    const assistantId = crypto.randomUUID()
    const assistantMsg: Message = { role: 'assistant', content: '', id: assistantId }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setIsStreaming(true)
    setStreamingId(assistantId)

    // Build history for API (exclude the empty assistant placeholder)
    const history = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/civic-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: history.slice(-8), // send last 8 messages for context
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: accumulated } : m,
          ),
        )
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
      setMessages((prev) => prev.filter((m) => m.id !== assistantId))
    } finally {
      setIsStreaming(false)
      setStreamingId(null)
      abortRef.current = null
      inputRef.current?.focus()
    }
  }, [isStreaming, messages])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send(input)
    }
  }

  function handleAbort() {
    abortRef.current?.abort()
    setIsStreaming(false)
    setStreamingId(null)
    // Remove the incomplete streaming message
    setMessages((prev) => prev.filter((m) => m.id !== streamingId))
  }

  function clearConversation() {
    abortRef.current?.abort()
    setMessages([])
    setIsStreaming(false)
    setStreamingId(null)
    setError(null)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const hasMessages = messages.length > 0

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      {/* Main layout */}
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 pt-4 pb-28 md:pb-12">

        {/* Page header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="Back to feed"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="font-mono text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple" aria-hidden="true" />
                The Civic Counsel
              </h1>
              <p className="text-xs font-mono text-surface-500">
                AI assistant grounded in real Lobby data
              </p>
            </div>
          </div>

          {hasMessages && (
            <button
              type="button"
              onClick={clearConversation}
              title="Clear conversation"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:bg-surface-300 hover:text-white text-xs font-mono transition-colors"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-surface-300 mb-4" />

        {/* Messages area */}
        <div className="flex-1 space-y-4 mb-4">
          <AnimatePresence initial={false}>
            {!hasMessages ? (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <WelcomeScreen onQuestion={(q) => void send(q)} />
              </motion.div>
            ) : (
              messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {msg.role === 'user' ? (
                    <UserMessage content={msg.content} />
                  ) : (
                    <AssistantMessage
                      content={msg.content}
                      isStreaming={isStreaming && msg.id === streamingId}
                    />
                  )}
                </motion.div>
              ))
            )}
          </AnimatePresence>

          {/* Error state */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3"
            >
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-against-500/20 border border-against-500/30 flex items-center justify-center">
                <X className="h-4 w-4 text-against-400" />
              </div>
              <div className="flex-1 rounded-2xl rounded-tl-sm bg-against-500/10 border border-against-500/30 p-4 text-sm text-against-400 font-mono">
                {error.includes('not configured')
                  ? 'The Civic Counsel is not available in this environment — AI features require an API key.'
                  : `Connection error: ${error}`}
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick questions — shown when there are messages but not streaming */}
        {hasMessages && !isStreaming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-none"
          >
            {[
              'What topics are trending?',
              'What laws passed recently?',
              'Most divisive debates?',
            ].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void send(q)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full bg-surface-200 border border-surface-300 text-surface-500 hover:bg-surface-300 hover:text-white text-xs font-mono transition-colors"
              >
                {q}
              </button>
            ))}
          </motion.div>
        )}

        {/* Input area */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-3">
          <div className="flex items-end gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask the Counsel about any civic debate, law, or position…"
              disabled={isStreaming}
              rows={1}
              className={cn(
                'flex-1 bg-transparent text-sm text-white placeholder-surface-600',
                'resize-none focus:outline-none leading-relaxed',
                'min-h-[36px] max-h-40',
                isStreaming && 'opacity-60',
              )}
              style={{ scrollbarWidth: 'none' }}
            />

            <div className="flex items-center gap-2 flex-shrink-0">
              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleAbort}
                  className="flex items-center justify-center h-9 w-9 rounded-xl bg-against-500/20 border border-against-500/30 text-against-400 hover:bg-against-500/30 transition-colors"
                  aria-label="Stop generating"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void send(input)}
                  disabled={!input.trim()}
                  className={cn(
                    'flex items-center justify-center h-9 w-9 rounded-xl transition-colors',
                    input.trim()
                      ? 'bg-purple text-white hover:bg-purple/80'
                      : 'bg-surface-300 text-surface-600 cursor-not-allowed',
                  )}
                  aria-label="Send message"
                >
                  {isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Footer hint */}
          <div className="flex items-center justify-between mt-2 px-0.5">
            <p className="text-[10px] font-mono text-surface-600">
              Press Enter to send, Shift+Enter for newline
            </p>
            {hasMessages && (
              <Link
                href="/topics"
                className="flex items-center gap-1 text-[10px] font-mono text-surface-600 hover:text-surface-500 transition-colors"
              >
                <Landmark className="h-2.5 w-2.5" aria-hidden="true" />
                Browse all topics
              </Link>
            )}
          </div>
        </div>

        {/* Related feature links */}
        {!hasMessages && (
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            {[
              { href: '/oracle', label: 'Oracle', icon: Zap, color: 'text-gold' },
              { href: '/advisor', label: 'Advisor', icon: Sparkles, color: 'text-purple' },
              { href: '/discover', label: 'Discover', icon: TrendingUp, color: 'text-for-400' },
              { href: '/laws', label: 'Laws', icon: Gavel, color: 'text-emerald' },
            ].map(({ href, label, icon: Icon, color }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-100 border border-surface-300 text-surface-500 hover:bg-surface-200 hover:text-surface-700 text-xs font-mono transition-colors"
              >
                <Icon className={cn('h-3 w-3', color)} aria-hidden="true" />
                {label}
              </Link>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
