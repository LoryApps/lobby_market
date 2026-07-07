'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Brain,
  ExternalLink,
  Loader2,
  RefreshCw,
  Scale,
  Send,
  Shield,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

interface TopicMeta {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

// ─── Suggested prompts (topic-aware) ─────────────────────────────────────────

interface Suggestion {
  icon: React.ComponentType<{ className?: string }>
  text: string
  color: string
}

function getSuggestions(forPct: number): Suggestion[] {
  const againstPct = 100 - forPct
  return [
    {
      icon: ThumbsUp,
      text: `What are the strongest arguments FOR (${forPct}% agree)?`,
      color: 'text-for-400',
    },
    {
      icon: ThumbsDown,
      text: `What are the strongest arguments AGAINST (${againstPct}% oppose)?`,
      color: 'text-against-400',
    },
    {
      icon: Brain,
      text: 'Give me a steelman of both sides',
      color: 'text-purple',
    },
    {
      icon: TrendingUp,
      text: 'What would change if this became law?',
      color: 'text-emerald',
    },
    {
      icon: Shield,
      text: 'What are the main objections and counterarguments?',
      color: 'text-gold',
    },
    {
      icon: Scale,
      text: 'How does this compare to similar policies elsewhere?',
      color: 'text-surface-400',
    },
  ]
}

// ─── Vote bar ─────────────────────────────────────────────────────────────────

function TopicBar({ topic }: { topic: TopicMeta }) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const STATUS_COLOR: Record<string, string> = {
    proposed: 'text-surface-500',
    active: 'text-emerald',
    voting: 'text-gold',
    law: 'text-gold',
    failed: 'text-against-400',
  }
  const STATUS_LABEL: Record<string, string> = {
    proposed: 'Proposed',
    active: 'Active',
    voting: 'Voting',
    law: 'Law',
    failed: 'Failed',
  }

  return (
    <div className="bg-surface-100 border-b border-surface-300 px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-white leading-snug line-clamp-2 flex-1">
          {topic.statement}
        </p>
        <Link
          href={`/topic/${topic.id}`}
          className="flex-shrink-0 flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
          aria-label="View full topic"
        >
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full transition-all duration-500"
            style={{ width: `${forPct}%` }}
          />
        </div>
        <div className="flex items-center gap-2 text-xs font-mono flex-shrink-0">
          <span className="text-for-400">{forPct}% FOR</span>
          <span className="text-surface-600">·</span>
          <span className="text-against-400">{againstPct}% AGAINST</span>
          <span className="text-surface-600">·</span>
          <span className={STATUS_COLOR[topic.status] ?? 'text-surface-500'}>
            {STATUS_LABEL[topic.status] ?? topic.status}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Markdown-lite renderer ───────────────────────────────────────────────────

function renderContent(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-bold text-white">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <span key={i}>{part}</span>
  })
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <div className="flex-shrink-0 h-8 w-8 rounded-xl bg-gradient-to-br from-purple/80 to-for-600 flex items-center justify-center shadow-lg shadow-purple/20 mt-0.5">
          <Sparkles className="h-4 w-4 text-white" aria-hidden="true" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3 text-sm font-mono leading-relaxed',
          isUser
            ? 'bg-for-600 text-white rounded-tr-sm'
            : 'bg-surface-200 border border-surface-300 text-surface-100 rounded-tl-sm',
        )}
      >
        {isUser ? (
          <span>{message.content}</span>
        ) : (
          <span>
            {renderContent(message.content)}
            {message.streaming && (
              <span
                className="inline-block ml-0.5 h-3.5 w-0.5 bg-purple animate-pulse rounded-full"
                aria-hidden="true"
              />
            )}
          </span>
        )}
      </div>
      {isUser && (
        <div className="flex-shrink-0 h-8 w-8 rounded-xl bg-surface-300 border border-surface-400 flex items-center justify-center mt-0.5">
          <span className="text-xs font-mono font-bold text-surface-500">You</span>
        </div>
      )}
    </motion.div>
  )
}

// ─── Welcome screen ───────────────────────────────────────────────────────────

function Welcome({
  topic,
  onSuggest,
}: {
  topic: TopicMeta | null
  onSuggest: (text: string) => void
}) {
  const forPct = Math.round(topic?.blue_pct ?? 50)
  const suggestions = getSuggestions(forPct)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center px-4 py-8 gap-6"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-purple/80 to-for-600 flex items-center justify-center shadow-xl shadow-purple/30">
          <Sparkles className="h-7 w-7 text-white" />
        </div>
        <div>
          <h2 className="font-mono font-bold text-white text-lg">Topic Counsel</h2>
          <p className="text-sm text-surface-500 font-mono mt-1">
            Ask me anything about this debate
          </p>
        </div>
      </div>

      <div className="w-full max-w-lg grid grid-cols-1 sm:grid-cols-2 gap-2">
        {suggestions.map((s, i) => {
          const Icon = s.icon
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSuggest(s.text)}
              className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-all text-left group"
            >
              <Icon
                className={cn('h-4 w-4 flex-shrink-0 mt-0.5', s.color)}
                aria-hidden="true"
              />
              <span className="text-xs font-mono text-surface-500 group-hover:text-surface-300 leading-relaxed transition-colors">
                {s.text}
              </span>
            </button>
          )
        })}
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CounselClient() {
  const params = useParams<{ id: string }>()
  const topicId = params.id

  const [topic, setTopic] = useState<TopicMeta | null>(null)
  const [topicLoading, setTopicLoading] = useState(true)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Load topic metadata
  useEffect(() => {
    async function loadTopic() {
      try {
        const res = await fetch(`/api/topics/${topicId}`)
        if (!res.ok) throw new Error('Topic not found')
        const data = (await res.json()) as { topic: TopicMeta }
        setTopic(data.topic)
      } catch {
        // topic stays null — counsel still works with generic context
      } finally {
        setTopicLoading(false)
      }
    }
    loadTopic()
  }, [topicId])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || sending) return

      setError(null)
      setInput('')
      setSending(true)

      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: trimmed,
      }

      const assistantMsgId = `a-${Date.now()}`
      const assistantMsg: Message = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        streaming: true,
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])

      abortRef.current = new AbortController()

      try {
        const history = messages.map((m) => ({ role: m.role, content: m.content }))

        const res = await fetch(`/api/civic-assistant/topic/${topicId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed, history }),
          signal: abortRef.current.signal,
        })

        if (!res.ok) {
          const err = (await res.json()) as { error?: string }
          throw new Error(err.error ?? 'Counsel error')
        }

        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let accumulated = ''

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            accumulated += decoder.decode(value, { stream: true })
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: accumulated, streaming: true }
                  : m,
              ),
            )
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, streaming: false } : m,
          ),
        )
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError((err as Error).message ?? 'Something went wrong.')
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId))
      } finally {
        setSending(false)
      }
    },
    [sending, messages, topicId],
  )

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      sendMessage(input)
    },
    [input, sendMessage],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage(input)
      }
    },
    [input, sendMessage],
  )

  const handleReset = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setError(null)
    setSending(false)
    inputRef.current?.focus()
  }, [])

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <TopBar />

      {/* Back nav */}
      <div className="border-b border-surface-300 bg-surface-100 px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
        <Link
          href={`/topic/${topicId}`}
          className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to topic
        </Link>
        <span className="text-surface-700 text-xs">·</span>
        <span className="text-xs font-mono text-purple flex items-center gap-1">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          Topic Counsel
        </span>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleReset}
            className="ml-auto flex items-center gap-1 text-xs font-mono text-surface-600 hover:text-surface-400 transition-colors"
            aria-label="Clear conversation"
          >
            <RefreshCw className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      {/* Topic bar */}
      {topicLoading ? (
        <div className="bg-surface-100 border-b border-surface-300 px-4 py-3 space-y-2 animate-pulse">
          <div className="h-4 bg-surface-300 rounded w-3/4" />
          <div className="h-1.5 bg-surface-300 rounded-full w-full" />
        </div>
      ) : topic ? (
        <TopicBar topic={topic} />
      ) : null}

      {/* Messages area */}
      <main
        className="flex-1 overflow-y-auto"
        role="log"
        aria-label="Conversation with Topic Counsel"
        aria-live="polite"
      >
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-4">
          <AnimatePresence initial={false}>
            {isEmpty ? (
              <Welcome topic={topic} onSuggest={sendMessage} key="welcome" />
            ) : (
              messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))
            )}
          </AnimatePresence>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-2 rounded-xl bg-against-500/10 border border-against-500/30 px-3 py-2.5 text-xs font-mono text-against-400"
                role="alert"
              >
                <span className="flex-1">{error}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  aria-label="Dismiss error"
                  className="flex-shrink-0 hover:text-against-300 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input area */}
      <div className="border-t border-surface-300 bg-surface-100 px-4 py-3 pb-[env(safe-area-inset-bottom)] flex-shrink-0">
        <div className="max-w-2xl mx-auto">
          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-2"
            aria-label="Send message to Topic Counsel"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about this debate…"
              disabled={sending}
              rows={1}
              aria-label="Your message"
              className="flex-1 resize-none rounded-2xl bg-surface-200 border border-surface-300 px-4 py-3 text-sm font-mono text-white placeholder-surface-600 focus:outline-none focus:ring-1 focus:ring-purple/50 focus:border-purple/50 disabled:opacity-50 transition-colors max-h-32 overflow-y-auto"
              style={{ minHeight: '44px' }}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send message"
              className={cn(
                'flex-shrink-0 h-11 w-11 rounded-2xl flex items-center justify-center transition-all',
                sending || !input.trim()
                  ? 'bg-surface-300 text-surface-600 cursor-not-allowed'
                  : 'bg-gradient-to-br from-purple/80 to-for-600 text-white shadow-lg shadow-purple/20 hover:shadow-purple/30 active:scale-95',
              )}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </form>
          <p className="text-center text-[11px] text-surface-600 font-mono mt-2">
            AI-powered analysis · Not a substitute for independent research
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
