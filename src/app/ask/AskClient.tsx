'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles, RefreshCw, Gavel, TrendingUp, Users, Scale } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

// ─── Suggested prompts ────────────────────────────────────────────────────────

const SUGGESTIONS = [
  { icon: TrendingUp, text: 'What are the most contested debates right now?' },
  { icon: Gavel, text: 'Which proposals are closest to becoming law?' },
  { icon: Scale, text: 'What are the strongest arguments on both sides of climate policy?' },
  { icon: Users, text: 'How does the Lobby reach consensus on a topic?' },
]

// ─── Markdown-lite renderer ───────────────────────────────────────────────────

function renderContent(text: string) {
  // Bold **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>
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
        <div className="flex-shrink-0 h-8 w-8 rounded-xl bg-gradient-to-br from-for-600 to-for-500 flex items-center justify-center shadow-lg shadow-for-600/30 mt-0.5">
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
              <span className="inline-block ml-0.5 h-3.5 w-0.5 bg-for-400 animate-pulse rounded-full" aria-hidden="true" />
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

function Welcome({ onSuggest }: { onSuggest: (text: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center flex-1 px-4 py-12 gap-8"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-for-600 to-for-500 flex items-center justify-center shadow-xl shadow-for-600/40">
          <Sparkles className="h-8 w-8 text-white" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-mono font-bold text-white">Civic Counsel</h1>
          <p className="text-sm font-mono text-surface-500 max-w-xs leading-relaxed">
            Ask anything about the debates, laws, and arguments shaping the Lobby — grounded in real platform data.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg">
        {SUGGESTIONS.map(({ icon: Icon, text }) => (
          <button
            key={text}
            onClick={() => onSuggest(text)}
            className={cn(
              'flex items-start gap-3 px-4 py-3.5 rounded-xl text-left',
              'bg-surface-200 border border-surface-300 hover:border-for-600/50 hover:bg-surface-300',
              'text-sm font-mono text-surface-300 hover:text-white',
              'transition-all duration-150',
            )}
          >
            <Icon className="h-4 w-4 text-for-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>{text}</span>
          </button>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AskClient() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [input])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || loading) return

      setInput('')
      setError(null)

      // Build history from current messages (excluding any still-streaming assistant message)
      const history = messages
        .filter((m) => !m.streaming)
        .map((m) => ({ role: m.role, content: m.content }))

      const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: trimmed }
      const assistantMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: '', streaming: true }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setLoading(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch('/api/civic-assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed, history }),
          signal: controller.signal,
        })

        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(json.error ?? `Server error ${res.status}`)
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error('No response stream')

        const decoder = new TextDecoder()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          accumulated += decoder.decode(value, { stream: true })

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: accumulated, streaming: true } : m,
            ),
          )
        }

        // Finalize
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: accumulated, streaming: false } : m,
          ),
        )
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        const msg = err instanceof Error ? err.message : 'Something went wrong'
        setError(msg)
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id))
      } finally {
        setLoading(false)
        abortRef.current = null
        setTimeout(() => textareaRef.current?.focus(), 50)
      }
    },
    [loading, messages],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleClear = () => {
    abortRef.current?.abort()
    setMessages([])
    setError(null)
    setLoading(false)
    textareaRef.current?.focus()
  }

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      {/* Main chat area */}
      <main className="flex flex-col flex-1 max-w-3xl mx-auto w-full px-4 pb-32 md:pb-16">
        {/* Header row (only when chatting) */}
        {hasMessages && (
          <div className="flex items-center justify-between py-4 border-b border-surface-300 mb-4 sticky top-0 bg-surface-50 z-10">
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-4 w-4 text-for-500" aria-hidden="true" />
              <span className="text-sm font-mono font-bold text-white">Civic Counsel</span>
            </div>
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
              aria-label="Clear conversation"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              New chat
            </button>
          </div>
        )}

        {/* Messages or welcome */}
        {!hasMessages ? (
          <Welcome onSuggest={(text) => sendMessage(text)} />
        ) : (
          <div className="flex flex-col gap-4 py-4">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </AnimatePresence>
            <div ref={bottomRef} />
          </div>
        )}

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-auto mt-2 px-4 py-2.5 rounded-xl bg-against-900/40 border border-against-700/50 text-against-300 text-xs font-mono max-w-sm text-center"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Input bar — fixed above bottom nav */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-40 border-t border-surface-300 bg-surface-100">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div
            className={cn(
              'flex items-end gap-2 rounded-2xl border px-3 py-2.5 transition-colors',
              'bg-surface-200',
              loading
                ? 'border-for-700/50'
                : 'border-surface-400 focus-within:border-for-600/70',
            )}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about the Lobby…"
              rows={1}
              maxLength={1000}
              disabled={loading}
              aria-label="Message input"
              className={cn(
                'flex-1 resize-none bg-transparent text-sm font-mono text-white placeholder-surface-500',
                'outline-none leading-relaxed',
                'disabled:opacity-50',
              )}
              style={{ height: 'auto', minHeight: '1.5rem' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              aria-label="Send message"
              className={cn(
                'flex-shrink-0 h-8 w-8 rounded-xl flex items-center justify-center',
                'transition-all duration-150',
                input.trim() && !loading
                  ? 'bg-for-600 hover:bg-for-500 text-white shadow-md shadow-for-600/30'
                  : 'bg-surface-300 text-surface-500 cursor-not-allowed',
              )}
            >
              {loading ? (
                <div className="h-3.5 w-3.5 border-2 border-surface-400 border-t-for-400 rounded-full animate-spin" aria-label="Loading" />
              ) : (
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
          <p className="text-center text-[10px] font-mono text-surface-600 mt-1.5">
            Powered by real Lobby data · Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
