'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  Brain,
  Calendar,
  Edit3,
  ExternalLink,
  FileText,
  Gavel,
  Loader2,
  Network,
  RefreshCw,
  Scale,
  Send,
  Sparkles,
  Users,
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

interface LawMeta {
  id: string
  statement: string
  category: string | null
  is_active: boolean
  blue_pct: number | null
  total_votes: number | null
  established_at: string | null
}

// ─── Suggested prompts (law-specific) ─────────────────────────────────────────

interface Suggestion {
  icon: React.ComponentType<{ className?: string }>
  text: string
  color: string
}

function getLawSuggestions(law: LawMeta | null): Suggestion[] {
  const forPct = Math.round(law?.blue_pct ?? 50)
  return [
    {
      icon: Brain,
      text: 'Explain the reasoning behind this law and what it accomplishes.',
      color: 'text-purple',
    },
    {
      icon: Scale,
      text: `Why did ${forPct}% agree with this? What made the FOR arguments compelling?`,
      color: 'text-for-400',
    },
    {
      icon: FileText,
      text: 'What are the strongest criticisms of this law? What did opponents argue?',
      color: 'text-against-400',
    },
    {
      icon: Network,
      text: 'How does this law connect to other laws in the Codex?',
      color: 'text-emerald',
    },
    {
      icon: Edit3,
      text: 'What changes might improve this law? How could it be amended?',
      color: 'text-gold',
    },
    {
      icon: BookOpen,
      text: 'Are there real-world policies similar to this? How have they performed?',
      color: 'text-surface-400',
    },
  ]
}

// ─── Law header bar ───────────────────────────────────────────────────────────

function LawBar({ law }: { law: LawMeta }) {
  const forPct = Math.round(law.blue_pct ?? 50)
  const established = law.established_at
    ? new Date(law.established_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null

  return (
    <div className="bg-surface-100 border-b border-surface-300 px-4 py-3 flex-shrink-0">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0 h-7 w-7 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center">
          <Gavel className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono font-semibold text-gold line-clamp-2">
            {law.statement}
          </p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {law.category && (
              <span className="text-[11px] font-mono text-surface-500">{law.category}</span>
            )}
            {established && (
              <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
                <Calendar className="h-3 w-3" aria-hidden="true" />
                Established {established}
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <Users className="h-3 w-3" aria-hidden="true" />
              {(law.total_votes ?? 0).toLocaleString()} votes · {forPct}% FOR
            </span>
          </div>
        </div>
        <Link
          href={`/law/${law.id}`}
          className="flex-shrink-0 text-[11px] font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
          aria-label="View full law"
        >
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
          View law
        </Link>
      </div>
      {/* Vote bar */}
      <div className="mt-2.5 h-1 w-full rounded-full bg-against-800 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full transition-all"
          style={{ width: `${forPct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Welcome / suggestions screen ─────────────────────────────────────────────

function Welcome({
  law,
  onSuggest,
}: {
  law: LawMeta | null
  onSuggest: (text: string) => void
}) {
  const suggestions = getLawSuggestions(law)

  return (
    <motion.div
      key="welcome"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-col items-center gap-6 pt-8 pb-4"
    >
      {/* Icon */}
      <div className="flex flex-col items-center gap-3">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-gold/20 to-emerald/10 border border-gold/30 flex items-center justify-center shadow-lg shadow-gold/10">
          <Sparkles className="h-7 w-7 text-gold" aria-hidden="true" />
        </div>
        <div className="text-center">
          <h1 className="text-base font-mono font-bold text-white">Law Counsel</h1>
          <p className="text-xs font-mono text-surface-500 mt-0.5">
            AI analysis of this established law
          </p>
        </div>
      </div>

      {/* Suggestions */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
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

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 h-7 w-7 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center mt-0.5">
          <Sparkles className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
        </div>
      )}

      {/* Bubble */}
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3 text-sm font-mono leading-relaxed',
          isUser
            ? 'bg-for-700/60 border border-for-600/40 text-white rounded-tr-sm'
            : 'bg-surface-100 border border-surface-300 text-surface-200 rounded-tl-sm',
        )}
      >
        {message.content || (
          <span className="flex items-center gap-1.5 text-surface-500">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            Thinking…
          </span>
        )}
        {message.streaming && message.content && (
          <span className="inline-block w-0.5 h-3.5 bg-gold/70 ml-0.5 animate-pulse align-text-bottom" />
        )}
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LawCounselClient() {
  const params = useParams<{ id: string }>()
  const lawId = params.id

  const [law, setLaw] = useState<LawMeta | null>(null)
  const [lawLoading, setLawLoading] = useState(true)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Load law metadata
  useEffect(() => {
    async function loadLaw() {
      try {
        const res = await fetch(`/api/laws/${lawId}`)
        if (!res.ok) throw new Error('Law not found')
        const data = (await res.json()) as { law: LawMeta }
        setLaw(data.law)
      } catch {
        // law stays null — counsel still works with generic context
      } finally {
        setLawLoading(false)
      }
    }
    loadLaw()
  }, [lawId])

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

        const res = await fetch(`/api/civic-assistant/law/${lawId}`, {
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
    [sending, messages, lawId],
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
          href={`/law/${lawId}`}
          className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to law
        </Link>
        <span className="text-surface-700 text-xs">·</span>
        <span className="text-xs font-mono text-gold flex items-center gap-1">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          Law Counsel
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

      {/* Law bar */}
      {lawLoading ? (
        <div className="bg-surface-100 border-b border-surface-300 px-4 py-3 space-y-2 animate-pulse">
          <div className="flex gap-3">
            <div className="h-7 w-7 rounded-lg bg-surface-300 flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 bg-surface-300 rounded w-3/4" />
              <div className="h-3 bg-surface-300 rounded w-1/3" />
            </div>
          </div>
          <div className="h-1 bg-surface-300 rounded-full w-full" />
        </div>
      ) : law ? (
        <LawBar law={law} />
      ) : null}

      {/* Messages area */}
      <main
        className="flex-1 overflow-y-auto"
        role="log"
        aria-label="Conversation with Law Counsel"
        aria-live="polite"
      >
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-4">
          <AnimatePresence initial={false}>
            {isEmpty ? (
              <Welcome law={law} onSuggest={sendMessage} key="welcome" />
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
            aria-label="Send message to Law Counsel"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about this law…"
              disabled={sending}
              rows={1}
              aria-label="Your message"
              className="flex-1 resize-none rounded-2xl bg-surface-200 border border-surface-300 px-4 py-3 text-sm font-mono text-white placeholder-surface-600 focus:outline-none focus:ring-1 focus:ring-gold/50 focus:border-gold/50 disabled:opacity-50 transition-colors max-h-32 overflow-y-auto"
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
                  : 'bg-gradient-to-br from-gold/80 to-emerald/60 text-white shadow-lg shadow-gold/20 hover:shadow-gold/30 active:scale-95',
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
            AI-powered analysis · Not a substitute for independent legal research
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
