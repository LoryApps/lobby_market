'use client'

/**
 * /socratic — The Socratic Lobby
 *
 * An AI-powered Socratic dialogue. The user picks a civic topic, states
 * their position, and Claude asks ONE probing question per turn — targeting
 * hidden assumptions, unexplored consequences, and logical tensions.
 *
 * After 5 turns, Claude synthesises what the dialogue revealed about the
 * user's reasoning: what assumptions they hold, where their logic held firm,
 * and what they might not have fully considered.
 *
 * Distinct from:
 *   /counsel   — Q&A about the platform (answers, not questions)
 *   /coach     — argument critique (feedback, not dialogue)
 *   /training  — skills drills (exercises, not open conversation)
 *   /debate/[id]/coach — prep for a specific registered debate
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  ChevronRight,
  HelpCircle,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { SocraticMessage } from '@/app/api/socratic/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopicOption {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

type Step = 'pick-topic' | 'pick-position' | 'dialogue' | 'synthesis'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_TURNS = 5
const MAX_USER_CHARS = 500
const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-surface-500',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

function catColor(cat: string | null) {
  return cat ? (CATEGORY_COLORS[cat] ?? 'text-surface-500') : 'text-surface-500'
}

// ─── Progress dots ────────────────────────────────────────────────────────────

function TurnDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`Turn ${current} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all',
            i < current ? 'bg-purple w-4' : i === current ? 'bg-purple/60 w-2.5' : 'bg-surface-300 w-1.5',
          )}
        />
      ))}
    </div>
  )
}

// ─── Topic search ─────────────────────────────────────────────────────────────

function TopicSearch({
  onSelect,
}: {
  onSelect: (t: TopicOption) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TopicOption[]>([])
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    debounce.current = setTimeout(async () => {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('topics')
          .select('id, statement, category, status, blue_pct, total_votes')
          .ilike('statement', `%${query.trim()}%`)
          .in('status', ['active', 'voting', 'proposed'])
          .order('total_votes', { ascending: false })
          .limit(8)
        setResults((data as TopicOption[]) ?? [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => {
      if (debounce.current) clearTimeout(debounce.current)
    }
  }, [query])

  // Load popular topics on mount
  useEffect(() => {
    async function loadPopular() {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('topics')
          .select('id, statement, category, status, blue_pct, total_votes')
          .in('status', ['active', 'voting'])
          .order('total_votes', { ascending: false })
          .limit(8)
        setResults((data as TopicOption[]) ?? [])
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    loadPopular()
  }, [])

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a civic topic…"
          className={cn(
            'w-full pl-9 pr-4 py-2.5 rounded-xl text-sm',
            'bg-surface-200 border border-surface-300',
            'text-surface-800 placeholder:text-surface-500',
            'focus:outline-none focus:ring-2 focus:ring-purple/40',
          )}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))
        ) : results.length === 0 && query.length >= 2 ? (
          <p className="text-sm text-surface-500 text-center py-4">No topics found.</p>
        ) : (
          results.map((t) => {
            const forPct = Math.round(t.blue_pct ?? 50)
            return (
              <button
                key={t.id}
                onClick={() => onSelect(t)}
                className={cn(
                  'w-full text-left p-3 rounded-xl border transition-all',
                  'bg-surface-100 border-surface-200 hover:border-purple/40 hover:bg-surface-200',
                  'group',
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-surface-800 font-medium line-clamp-2 leading-snug">
                      {t.statement}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {t.category && (
                        <span className={cn('text-[10px] font-mono uppercase tracking-wider', catColor(t.category))}>
                          {t.category}
                        </span>
                      )}
                      <span className="text-[10px] text-surface-500 font-mono">
                        {forPct}% FOR · {t.total_votes?.toLocaleString() ?? 0} votes
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-400 flex-shrink-0 mt-0.5 group-hover:text-purple transition-colors" />
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Dialogue bubble ──────────────────────────────────────────────────────────

function Bubble({
  role,
  content,
  streaming,
}: {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}) {
  const isUser = role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-2.5', isUser && 'flex-row-reverse')}
    >
      <div
        className={cn(
          'flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center mt-0.5',
          isUser ? 'bg-purple/20' : 'bg-surface-200',
        )}
      >
        {isUser ? (
          <span className="text-[10px] font-bold text-purple">YOU</span>
        ) : (
          <Bot className="h-3.5 w-3.5 text-surface-500" aria-hidden="true" />
        )}
      </div>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-purple/15 text-surface-800 rounded-tr-sm'
            : 'bg-surface-200 text-surface-700 rounded-tl-sm',
        )}
      >
        {content}
        {streaming && (
          <span className="inline-block ml-0.5 h-3.5 w-0.5 bg-purple animate-pulse align-middle" />
        )}
      </div>
    </motion.div>
  )
}

// ─── Synthesis card ───────────────────────────────────────────────────────────

function SynthesisCard({ content, onReset }: { content: string; onReset: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl border border-purple/30 bg-purple/5 p-5 space-y-4"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-purple" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-purple">Socratic Synthesis</h2>
      </div>
      <p className="text-sm text-surface-700 leading-relaxed whitespace-pre-wrap">{content}</p>
      <div className="pt-2 flex gap-3">
        <Button variant="ghost" size="sm" onClick={onReset} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          New dialogue
        </Button>
        <Link href="/topics">
          <Button size="sm" className="gap-1.5 bg-purple text-white hover:bg-purple/80">
            <ArrowRight className="h-3.5 w-3.5" />
            Vote on topics
          </Button>
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SocraticClient() {
  const [step, setStep] = useState<Step>('pick-topic')
  const [topic, setTopic] = useState<TopicOption | null>(null)
  const [position, setPosition] = useState<'for' | 'against' | null>(null)
  const [history, setHistory] = useState<SocraticMessage[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [userInput, setUserInput] = useState('')
  const [turn, setTurn] = useState(0)
  const [synthesis, setSynthesis] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, streamingContent])

  const sendMessage = useCallback(
    async (msg: string) => {
      if (!topic || !position || isStreaming) return
      const trimmed = msg.trim()
      if (!trimmed) return

      const newTurn = turn + 1
      const userMsg: SocraticMessage = { role: 'user', content: trimmed }
      setHistory((prev) => [...prev, userMsg])
      setUserInput('')
      setIsStreaming(true)
      setStreamingContent('')

      try {
        const res = await fetch('/api/socratic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic_id: topic.id,
            topic_statement: topic.statement,
            topic_category: topic.category,
            user_position: position,
            history,
            user_message: trimmed,
            turn: newTurn,
          }),
        })

        if (!res.ok) {
          throw new Error('Failed to get response')
        }

        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let full = ''

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value)
            full += chunk
            setStreamingContent(full)
          }
        }

        const assistantMsg: SocraticMessage = { role: 'assistant', content: full }
        setHistory((prev) => [...prev, assistantMsg])
        setStreamingContent('')
        setTurn(newTurn)

        if (newTurn >= MAX_TURNS) {
          setSynthesis(full)
          setStep('synthesis')
        }
      } catch {
        setHistory((prev) => [
          ...prev,
          { role: 'assistant', content: 'The Socratic engine is temporarily unavailable. Please try again.' },
        ])
      } finally {
        setIsStreaming(false)
        inputRef.current?.focus()
      }
    },
    [topic, position, isStreaming, history, turn],
  )

  // Kick off the dialogue with the opening question
  const startDialogue = useCallback(
    async (pos: 'for' | 'against') => {
      if (!topic) return
      setPosition(pos)
      setStep('dialogue')
      setTurn(0)
      setHistory([])
      setIsStreaming(true)
      setStreamingContent('')

      const openingMessage = pos === 'for'
        ? `I believe this policy should be adopted. ${topic.statement}`
        : `I believe this policy should be rejected. ${topic.statement}`

      try {
        const res = await fetch('/api/socratic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic_id: topic.id,
            topic_statement: topic.statement,
            topic_category: topic.category,
            user_position: pos,
            history: [],
            user_message: openingMessage,
            turn: 1,
          }),
        })

        if (!res.ok) throw new Error('Failed to start dialogue')

        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let full = ''

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            full += decoder.decode(value)
            setStreamingContent(full)
          }
        }

        setHistory([
          { role: 'user', content: openingMessage },
          { role: 'assistant', content: full },
        ])
        setStreamingContent('')
        setTurn(1)
      } catch {
        setHistory([
          { role: 'user', content: openingMessage },
          { role: 'assistant', content: 'The Socratic engine is temporarily unavailable. Please try again.' },
        ])
      } finally {
        setIsStreaming(false)
        inputRef.current?.focus()
      }
    },
    [topic],
  )

  function reset() {
    setStep('pick-topic')
    setTopic(null)
    setPosition(null)
    setHistory([])
    setStreamingContent('')
    setIsStreaming(false)
    setUserInput('')
    setTurn(0)
    setSynthesis('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (userInput.trim() && !isStreaming) {
        sendMessage(userInput)
      }
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
        {/* ─── Header ──────────────────────────────────────────────────── */}
        <div className="px-4 pt-5 pb-3 flex items-center gap-3">
          {step !== 'pick-topic' && (
            <button
              onClick={reset}
              className="text-surface-500 hover:text-surface-700 transition-colors"
              aria-label="Start over"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-surface-800">Socratic Lobby</h1>
              <Badge variant="default" size="xs" className="bg-purple/15 text-purple border-purple/25">Beta</Badge>
            </div>
            <p className="text-xs text-surface-500 mt-0.5">
              {step === 'pick-topic' && 'Pick a civic topic to examine your reasoning'}
              {step === 'pick-position' && 'State your position to begin the dialogue'}
              {step === 'dialogue' && `Turn ${turn} of ${MAX_TURNS} — answer to continue`}
              {step === 'synthesis' && 'The Socratic dialogue is complete'}
            </p>
          </div>
          {(step === 'dialogue' || step === 'synthesis') && (
            <TurnDots current={turn} total={MAX_TURNS} />
          )}
        </div>

        {/* ─── Topic pick ───────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {step === 'pick-topic' && (
            <motion.div
              key="pick-topic"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex-1 px-4 pb-4 space-y-4"
            >
              {/* Explainer */}
              <div className="rounded-xl border border-purple/20 bg-purple/5 p-4 flex gap-3">
                <HelpCircle className="h-5 w-5 text-purple flex-shrink-0 mt-0.5" />
                <div className="text-sm text-surface-600 space-y-1">
                  <p className="font-medium text-surface-700">How Socratic Lobby works</p>
                  <p>
                    You state your position. Claude asks ONE probing question per turn — no lectures,
                    no information, just targeted questions that reveal what you haven't examined.
                    After {MAX_TURNS} turns, you get a synthesis of your reasoning.
                  </p>
                </div>
              </div>

              <TopicSearch onSelect={(t) => { setTopic(t); setStep('pick-position') }} />
            </motion.div>
          )}

          {/* ─── Position pick ─────────────────────────────────────────── */}
          {step === 'pick-position' && topic && (
            <motion.div
              key="pick-position"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex-1 px-4 pb-4 space-y-4"
            >
              {/* Topic card */}
              <div className="rounded-xl border border-surface-200 bg-surface-100 p-4">
                {topic.category && (
                  <span className={cn('text-[10px] font-mono uppercase tracking-wider', catColor(topic.category))}>
                    {topic.category}
                  </span>
                )}
                <p className="mt-1 text-base font-semibold text-surface-800 leading-snug">
                  {topic.statement}
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs text-surface-500 font-mono">
                  <span>{Math.round(topic.blue_pct ?? 50)}% FOR</span>
                  <span>·</span>
                  <span>{(topic.total_votes ?? 0).toLocaleString()} votes</span>
                </div>
              </div>

              <p className="text-sm font-medium text-surface-700 text-center">
                What is your position on this topic?
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => startDialogue('for')}
                  className={cn(
                    'flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all',
                    'bg-for-500/5 border-for-500/30 hover:border-for-500 hover:bg-for-500/10',
                    'group',
                  )}
                >
                  <ThumbsUp className="h-6 w-6 text-for-500 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-bold text-for-500">FOR</span>
                  <span className="text-xs text-surface-500 text-center">I support this policy</span>
                </button>
                <button
                  onClick={() => startDialogue('against')}
                  className={cn(
                    'flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all',
                    'bg-against-500/5 border-against-500/30 hover:border-against-500 hover:bg-against-500/10',
                    'group',
                  )}
                >
                  <ThumbsDown className="h-6 w-6 text-against-500 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-bold text-against-500">AGAINST</span>
                  <span className="text-xs text-surface-500 text-center">I oppose this policy</span>
                </button>
              </div>

              <p className="text-xs text-surface-400 text-center">
                Claude will question your reasoning — not support it or refute it.
              </p>
            </motion.div>
          )}

          {/* ─── Dialogue ─────────────────────────────────────────────── */}
          {(step === 'dialogue' || step === 'synthesis') && topic && (
            <motion.div
              key="dialogue"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col"
            >
              {/* Topic strip */}
              <div className={cn(
                'mx-4 mb-3 p-2.5 rounded-lg border text-xs flex items-center gap-2',
                position === 'for'
                  ? 'bg-for-500/5 border-for-500/20'
                  : 'bg-against-500/5 border-against-500/20',
              )}>
                {position === 'for' ? (
                  <ThumbsUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
                ) : (
                  <ThumbsDown className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
                )}
                <span className={cn('font-mono font-bold uppercase tracking-wider', position === 'for' ? 'text-for-400' : 'text-against-400')}>
                  {position?.toUpperCase()}
                </span>
                <span className="text-surface-500 flex-1 min-w-0 line-clamp-1">{topic.statement}</span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 space-y-4 pb-4">
                {history.map((msg, i) => (
                  <Bubble key={i} role={msg.role} content={msg.content} />
                ))}

                {/* Streaming bubble */}
                {isStreaming && streamingContent && (
                  <Bubble role="assistant" content={streamingContent} streaming />
                )}

                {/* Loading indicator */}
                {isStreaming && !streamingContent && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-2.5"
                  >
                    <div className="h-7 w-7 rounded-full bg-surface-200 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-3.5 w-3.5 text-surface-500" />
                    </div>
                    <div className="bg-surface-200 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 bg-surface-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 150}ms` }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Synthesis result */}
                {step === 'synthesis' && synthesis && (
                  <SynthesisCard content={synthesis} onReset={reset} />
                )}

                <div ref={bottomRef} />
              </div>

              {/* Input area */}
              {step === 'dialogue' && (
                <div className="border-t border-surface-200 px-4 py-3 bg-surface-50">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 relative">
                      <textarea
                        ref={inputRef}
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Respond to the question… (Enter to send)"
                        rows={2}
                        maxLength={MAX_USER_CHARS}
                        disabled={isStreaming}
                        className={cn(
                          'w-full resize-none rounded-xl px-3.5 py-2.5 text-sm',
                          'bg-surface-200 border border-surface-300',
                          'text-surface-800 placeholder:text-surface-500',
                          'focus:outline-none focus:ring-2 focus:ring-purple/40',
                          'disabled:opacity-50',
                        )}
                      />
                      {userInput.length > MAX_USER_CHARS * 0.8 && (
                        <span className={cn(
                          'absolute bottom-2 right-2 text-[10px] font-mono',
                          userInput.length >= MAX_USER_CHARS ? 'text-against-400' : 'text-surface-400',
                        )}>
                          {MAX_USER_CHARS - userInput.length}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => sendMessage(userInput)}
                      disabled={isStreaming || !userInput.trim()}
                      aria-label="Send response"
                      className={cn(
                        'h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0',
                        'transition-all',
                        isStreaming || !userInput.trim()
                          ? 'bg-surface-200 text-surface-400 cursor-not-allowed'
                          : 'bg-purple text-white hover:bg-purple/80',
                      )}
                    >
                      {isStreaming ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-surface-400 mt-1.5 text-center">
                    {MAX_TURNS - turn} question{MAX_TURNS - turn === 1 ? '' : 's'} remaining · Shift+Enter for new line
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
