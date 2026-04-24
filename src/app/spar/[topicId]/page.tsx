'use client'

/**
 * /spar/[topicId] — AI Sparring Partner
 *
 * A 5-round debate practice arena where users argue against Claude.
 * The user picks a side; Claude argues the opposite. After 5 rounds,
 * Claude delivers coaching feedback.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Bot,
  ChevronRight,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Shield,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  User,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { SparMessage, SparResponse } from '@/app/api/spar/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_ROUNDS = 5
const MAX_CHARS = 400

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'loading' | 'pick-side' | 'debate' | 'feedback' | 'unavailable'

interface TopicData {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function RoundPip({ filled, current }: { filled: boolean; current: boolean }) {
  return (
    <div
      className={cn(
        'h-2 w-2 rounded-full transition-all duration-300',
        current ? 'scale-125 bg-purple ring-2 ring-purple/30' : filled ? 'bg-for-500' : 'bg-surface-400',
      )}
    />
  )
}

// ─── Side selector ────────────────────────────────────────────────────────────

function SidePicker({
  statement,
  onPick,
}: {
  statement: string
  onPick: (side: 'for' | 'against') => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-8 max-w-lg mx-auto px-4 pt-10"
    >
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-purple mb-4">
          <Swords className="h-5 w-5" />
          <span className="text-sm font-semibold font-mono uppercase tracking-widest">
            AI Sparring Partner
          </span>
        </div>
        <h1 className="text-xl font-bold text-white leading-snug">Pick your side</h1>
        <p className="text-sm text-surface-400 leading-relaxed">
          Argue your position across {MAX_ROUNDS} rounds. Claude takes the opposite side.
        </p>
      </div>

      {/* Topic statement */}
      <div className="w-full rounded-xl border border-surface-300 bg-surface-100 p-4">
        <p className="text-sm text-surface-400 font-mono mb-1">TOPIC</p>
        <p className="text-base font-semibold text-white leading-snug">{statement}</p>
      </div>

      {/* Side buttons */}
      <div className="w-full grid grid-cols-2 gap-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onPick('for')}
          className={cn(
            'flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all',
            'border-for-500/40 bg-for-500/10 hover:bg-for-500/20 hover:border-for-400',
          )}
        >
          <div className="h-12 w-12 rounded-full bg-for-500/20 flex items-center justify-center">
            <ThumbsUp className="h-6 w-6 text-for-400" />
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-for-300 font-mono">FOR</p>
            <p className="text-xs text-surface-400 mt-0.5">I support this</p>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onPick('against')}
          className={cn(
            'flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all',
            'border-against-500/40 bg-against-500/10 hover:bg-against-500/20 hover:border-against-400',
          )}
        >
          <div className="h-12 w-12 rounded-full bg-against-500/20 flex items-center justify-center">
            <ThumbsDown className="h-6 w-6 text-against-400" />
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-against-300 font-mono">AGAINST</p>
            <p className="text-xs text-surface-400 mt-0.5">I oppose this</p>
          </div>
        </motion.button>
      </div>

      <p className="text-xs text-surface-500 text-center">
        Claude will counter every argument. Keep it sharp.
      </p>
    </motion.div>
  )
}

// ─── Bubble ───────────────────────────────────────────────────────────────────

function Bubble({
  msg,
  userSide,
  index,
}: {
  msg: SparMessage
  userSide: 'for' | 'against'
  index: number
}) {
  const isUser = msg.role === 'user'
  const aiSide = userSide === 'for' ? 'against' : 'for'
  const side = isUser ? userSide : aiSide

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.02 }}
      className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center',
          isUser
            ? 'bg-surface-300 border border-surface-400'
            : 'bg-purple/20 border border-purple/30',
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-surface-400" />
        ) : (
          <Bot className="h-4 w-4 text-purple" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? side === 'for'
              ? 'bg-for-600/25 border border-for-500/30 text-for-100 rounded-tr-sm'
              : 'bg-against-600/25 border border-against-500/30 text-against-100 rounded-tr-sm'
            : 'bg-surface-200 border border-surface-300 text-surface-200 rounded-tl-sm',
        )}
      >
        {/* Side label */}
        <p
          className={cn(
            'text-[10px] font-mono font-bold uppercase tracking-widest mb-1',
            isUser
              ? side === 'for' ? 'text-for-400' : 'text-against-400'
              : side === 'for' ? 'text-for-500' : 'text-against-500',
          )}
        >
          {isUser ? 'YOU' : 'AI'} · {side.toUpperCase()}
        </p>
        <p>{msg.content}</p>
      </div>
    </motion.div>
  )
}

// ─── Feedback card ────────────────────────────────────────────────────────────

function FeedbackCard({
  feedback,
  round,
  topicId,
  onReset,
}: {
  feedback: string
  round: number
  topicId: string
  onReset: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-6"
    >
      <div className="flex items-center gap-2.5 text-gold">
        <Trophy className="h-5 w-5" />
        <span className="text-sm font-semibold font-mono uppercase tracking-widest">
          Debate Complete
        </span>
      </div>

      <div className="rounded-2xl border border-gold/20 bg-gold/5 p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Bot className="h-4 w-4 text-purple" />
          <span className="text-xs font-mono text-purple uppercase tracking-widest">
            AI Coach Feedback
          </span>
        </div>
        {feedback
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line, i) => (
            <p key={i} className="text-sm text-surface-200 leading-relaxed">
              {line}
            </p>
          ))}
      </div>

      <div className="flex items-center gap-2 text-xs text-surface-500">
        <MessageSquare className="h-3.5 w-3.5" />
        <span>{round} round{round !== 1 ? 's' : ''} completed</span>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={onReset}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-purple/15 border border-purple/30 text-purple text-sm font-semibold hover:bg-purple/25 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Spar again
        </button>
        <Link
          href={`/topic/${topicId}`}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-200 border border-surface-300 text-surface-300 text-sm font-semibold hover:bg-surface-300 transition-colors"
        >
          Back to topic
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SparPage() {
  const params = useParams<{ topicId: string }>()
  const topicId = params.topicId

  const [phase, setPhase] = useState<Phase>('loading')
  const [topic, setTopic] = useState<TopicData | null>(null)
  const [userSide, setUserSide] = useState<'for' | 'against' | null>(null)
  const [history, setHistory] = useState<SparMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [round, setRound] = useState(0)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Fetch topic + auth state
  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user)
    })

    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .eq('id', topicId)
      .single()
      .then(({ data }) => {
        if (!data) {
          setPhase('unavailable')
          return
        }
        setTopic(data as TopicData)
        setPhase('pick-side')
      })
  }, [topicId])

  // Auto-scroll to bottom when history changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, sending])

  const startDebate = useCallback(
    async (side: 'for' | 'against') => {
      if (!topic) return
      setUserSide(side)
      setPhase('debate')
      setSending(true)

      // Claude makes the opening move
      const openingUserMsg: SparMessage = {
        role: 'user',
        content: `[Opening — I will argue ${side.toUpperCase()}. Please open the debate with your strongest point.]`,
      }

      try {
        const res = await fetch('/api/spar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic_id: topicId,
            topic_statement: topic.statement,
            category: topic.category,
            user_side: side,
            history: [openingUserMsg],
            mode: 'debate',
          }),
        })

        const data: SparResponse = await res.json()

        if (data.unavailable) {
          setPhase('unavailable')
          return
        }

        const aiMsg: SparMessage = { role: 'assistant', content: data.response }
        setHistory([aiMsg])
        setRound(0)
      } catch {
        // best-effort; user can still type their opening
      } finally {
        setSending(false)
        inputRef.current?.focus()
      }
    },
    [topic, topicId],
  )

  const sendMessage = useCallback(async () => {
    if (!input.trim() || sending || !topic || !userSide) return

    const userMsg: SparMessage = { role: 'user', content: input.trim() }
    const newHistory = [...history, userMsg]
    setHistory(newHistory)
    setInput('')
    setSending(true)

    const newRound = round + 1

    if (newRound >= MAX_ROUNDS) {
      // Final round — request feedback instead
      try {
        const res = await fetch('/api/spar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic_id: topicId,
            topic_statement: topic.statement,
            category: topic.category,
            user_side: userSide,
            history: newHistory,
            mode: 'feedback',
          }),
        })
        const data: SparResponse = await res.json()
        setFeedback(data.response)
        setRound(newRound)
        setPhase('feedback')
      } catch {
        setFeedback('Great debate! You made it through all rounds.')
        setPhase('feedback')
      } finally {
        setSending(false)
      }
      return
    }

    // Normal debate round
    try {
      const res = await fetch('/api/spar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: topicId,
          topic_statement: topic.statement,
          category: topic.category,
          user_side: userSide,
          history: newHistory,
          mode: 'debate',
        }),
      })
      const data: SparResponse = await res.json()
      const aiMsg: SparMessage = { role: 'assistant', content: data.response }
      setHistory((prev) => [...prev, aiMsg])
      setRound(newRound)
    } catch {
      // silent
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }, [input, sending, topic, topicId, userSide, history, round])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    },
    [sendMessage],
  )

  const reset = useCallback(() => {
    setPhase('pick-side')
    setUserSide(null)
    setHistory([])
    setInput('')
    setRound(0)
    setFeedback(null)
    setSending(false)
  }, [])

  const aiSide = userSide === 'for' ? 'against' : 'for'

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-surface-0">
      <TopBar />

      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-200 bg-surface-50">
        <Link
          href={topic ? `/topic/${topicId}` : '/'}
          className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white transition-colors"
          aria-label="Back to topic"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Swords className="h-3.5 w-3.5 text-purple flex-shrink-0" />
            <span className="text-xs font-mono font-semibold text-purple uppercase tracking-widest">
              AI Spar
            </span>
          </div>
          {topic && (
            <p className="text-[11px] text-surface-500 truncate mt-0.5">
              {topic.statement}
            </p>
          )}
        </div>

        {/* Round counter */}
        {phase === 'debate' && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {Array.from({ length: MAX_ROUNDS }).map((_, i) => (
              <RoundPip key={i} filled={i < round} current={i === round} />
            ))}
          </div>
        )}

        {/* Side badges */}
        {userSide && phase !== 'feedback' && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase',
                userSide === 'for'
                  ? 'bg-for-600/20 text-for-400'
                  : 'bg-against-600/20 text-against-400',
              )}
            >
              You: {userSide}
            </span>
            <span
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase',
                aiSide === 'for'
                  ? 'bg-for-600/10 text-for-600'
                  : 'bg-against-600/10 text-against-600',
              )}
            >
              AI: {aiSide}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {/* Loading */}
          {phase === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center h-full"
            >
              <Loader2 className="h-6 w-6 text-surface-500 animate-spin" />
            </motion.div>
          )}

          {/* Unavailable */}
          {phase === 'unavailable' && (
            <motion.div
              key="unavailable"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4 px-6 pt-20 text-center"
            >
              <Shield className="h-10 w-10 text-surface-500" />
              <h2 className="text-lg font-bold text-white">AI Spar unavailable</h2>
              <p className="text-sm text-surface-400 max-w-xs leading-relaxed">
                The AI sparring feature requires an Anthropic API key. Check back later or
                practice your arguments in the debate section.
              </p>
              <Link
                href={topic ? `/topic/${topicId}` : '/'}
                className="mt-2 text-sm text-for-400 hover:text-for-300 transition-colors"
              >
                Back to topic
              </Link>
            </motion.div>
          )}

          {/* Pick side */}
          {phase === 'pick-side' && topic && (
            <motion.div key="pick-side" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {!isLoggedIn ? (
                <div className="flex flex-col items-center gap-4 px-6 pt-20 text-center">
                  <Swords className="h-10 w-10 text-surface-500" />
                  <h2 className="text-lg font-bold text-white">Sign in to spar</h2>
                  <p className="text-sm text-surface-400 max-w-xs leading-relaxed">
                    AI sparring is available to registered Lobby Market members.
                  </p>
                  <Link
                    href="/auth/login"
                    className="mt-2 px-5 py-2.5 rounded-xl bg-for-600 text-white text-sm font-semibold hover:bg-for-500 transition-colors"
                  >
                    Sign in
                  </Link>
                </div>
              ) : (
                <SidePicker statement={topic.statement} onPick={startDebate} />
              )}
            </motion.div>
          )}

          {/* Debate */}
          {phase === 'debate' && (
            <motion.div
              key="debate"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col gap-4 px-4 pt-4 pb-36"
            >
              {/* Intro banner */}
              {history.length === 0 && !sending && (
                <div className="rounded-xl border border-purple/20 bg-purple/5 px-4 py-3 text-center">
                  <p className="text-xs text-purple font-mono">
                    Claude is thinking of the opening argument…
                  </p>
                </div>
              )}

              {/* Message bubbles */}
              {history.map((msg, i) => (
                <Bubble key={i} msg={msg} userSide={userSide!} index={i} />
              ))}

              {/* Typing indicator */}
              {sending && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3"
                >
                  <div className="h-8 w-8 rounded-full bg-purple/20 border border-purple/30 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-purple" />
                  </div>
                  <div className="bg-surface-200 border border-surface-300 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="h-1.5 w-1.5 bg-surface-500 rounded-full"
                        animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Last round message */}
              {round === MAX_ROUNDS - 1 && !sending && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-xl border border-gold/20 bg-gold/5 px-4 py-3 text-center"
                >
                  <p className="text-xs text-gold font-mono">
                    Final round — make it count. Hit send for your closing argument.
                  </p>
                </motion.div>
              )}

              <div ref={bottomRef} />
            </motion.div>
          )}

          {/* Feedback */}
          {phase === 'feedback' && feedback && (
            <motion.div key="feedback" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <FeedbackCard
                feedback={feedback}
                round={round}
                topicId={topicId}
                onReset={reset}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input bar — only visible during debate */}
      <AnimatePresence>
        {phase === 'debate' && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-16 left-0 right-0 z-20 border-t border-surface-200 bg-surface-0/95 backdrop-blur-sm px-4 py-3"
          >
            {/* Round / char info */}
            <div className="flex items-center justify-between mb-2 text-[10px] font-mono text-surface-600">
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-purple" />
                Round {round + 1} of {MAX_ROUNDS}
              </span>
              <span className={input.length > MAX_CHARS * 0.85 ? 'text-against-400' : ''}>
                {input.length}/{MAX_CHARS}
              </span>
            </div>

            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_CHARS) setInput(e.target.value)
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  history.length === 0
                    ? 'Waiting for Claude to open…'
                    : 'Your argument… (Enter to send)'
                }
                disabled={sending || history.length === 0}
                rows={2}
                className={cn(
                  'flex-1 resize-none rounded-xl px-3 py-2.5 text-sm',
                  'bg-surface-100 border border-surface-300 text-white placeholder-surface-600',
                  'focus:outline-none focus:border-purple/50',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                )}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending || history.length === 0}
                aria-label="Send argument"
                className={cn(
                  'flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center',
                  'bg-purple/80 hover:bg-purple border border-purple/50 text-white',
                  'transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                )}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>

            <p className="text-[10px] text-surface-600 mt-1.5 text-center">
              Shift+Enter for new line · Enter to send
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  )
}
