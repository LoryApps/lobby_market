'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Check,
  HelpCircle,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  ThumbsUp,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { TopicQuestion, QuestionsResponse } from '@/app/api/topics/[id]/questions/route'
import type { TopicAnswer } from '@/app/api/topics/[id]/questions/[qid]/answers/route'

// ─── Props ────────────────────────────────────────────────────────────────────

interface AskClientProps {
  topicId: string
  topicStatement: string
  topicCategory: string | null
  topicStatus: string
  bluePct: number
  totalVotes: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Answer item ──────────────────────────────────────────────────────────────

function AnswerItem({ answer }: { answer: TopicAnswer }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex gap-3 p-3 rounded-xl',
        answer.is_accepted
          ? 'bg-emerald/5 border border-emerald/20'
          : 'bg-surface-200/40 border border-surface-300/50'
      )}
    >
      {/* Accepted indicator */}
      {answer.is_accepted && (
        <div className="flex-shrink-0 flex items-center justify-center h-5 w-5 mt-0.5 rounded-full bg-emerald/20 border border-emerald/40">
          <Check className="h-2.5 w-2.5 text-emerald" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm text-surface-100 leading-relaxed">{answer.content}</p>
        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-1.5">
            {answer.author && (
              <>
                <Avatar
                  src={answer.author.avatar_url}
                  fallback={answer.author.display_name || answer.author.username}
                  size="xs"
                />
                <Link
                  href={`/profile/${answer.author.username}`}
                  className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                >
                  {answer.author.display_name || answer.author.username}
                </Link>
              </>
            )}
            <span className="text-[10px] text-surface-600 font-mono">
              · {relativeTime(answer.created_at)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-surface-500 font-mono">
            <ThumbsUp className="h-2.5 w-2.5" />
            {answer.upvotes}
          </div>
          {answer.is_accepted && (
            <span className="text-[10px] font-mono text-emerald font-semibold">
              Accepted answer
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Answer form ──────────────────────────────────────────────────────────────

function AnswerForm({
  topicId,
  questionId,
  onSubmitted,
}: {
  topicId: string
  questionId: string
  onSubmitted: (answer: TopicAnswer) => void
}) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function handleSubmit() {
    const trimmed = text.trim()
    if (trimmed.length < 10) {
      setError('Answer must be at least 10 characters.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/questions/${questionId}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      })
      if (res.status === 401) {
        setError('Sign in to answer.')
        return
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Failed to submit. Try again.')
        return
      }
      const { answer } = await res.json()
      setText('')
      onSubmitted(answer)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-4 space-y-2">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a clear, factual answer…"
        rows={3}
        maxLength={1000}
        className={cn(
          'w-full rounded-xl bg-surface-100 border px-4 py-3',
          'text-sm font-mono text-white placeholder:text-surface-600',
          'resize-none focus:outline-none focus:ring-1 transition-colors',
          error
            ? 'border-against-500/60 focus:ring-against-500/40'
            : 'border-surface-400 focus:border-surface-300 focus:ring-surface-400/30'
        )}
        aria-label="Your answer"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-mono text-surface-600">
          {text.length}/1000
        </span>
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-[11px] font-mono text-against-400">{error}</span>
          )}
          <Button
            onClick={handleSubmit}
            disabled={submitting || text.trim().length < 10}
            size="sm"
            className="flex items-center gap-1.5"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {submitting ? 'Posting…' : 'Post answer'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Question card ────────────────────────────────────────────────────────────

function QuestionCard({
  question,
  topicId,
}: {
  question: TopicQuestion
  topicId: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [answers, setAnswers] = useState<TopicAnswer[]>([])
  const [loadingAnswers, setLoadingAnswers] = useState(false)
  const [showAnswerForm, setShowAnswerForm] = useState(false)
  const [voted, setVoted] = useState(question.user_voted)
  const [upvotes, setUpvotes] = useState(question.upvotes)
  const [voting, setVoting] = useState(false)

  async function loadAnswers() {
    if (answers.length > 0) return
    setLoadingAnswers(true)
    try {
      const res = await fetch(`/api/topics/${topicId}/questions/${question.id}/answers`)
      if (res.ok) {
        const { answers: data } = await res.json()
        setAnswers(data ?? [])
      }
    } catch {
      // silent
    } finally {
      setLoadingAnswers(false)
    }
  }

  async function handleToggle() {
    if (!expanded && question.answer_count > 0) await loadAnswers()
    setExpanded((v) => !v)
  }

  async function handleVote() {
    if (voting) return
    setVoting(true)
    const prev = voted
    setVoted(!prev)
    setUpvotes((n) => n + (prev ? -1 : 1))
    try {
      await fetch(`/api/topics/${topicId}/questions/${question.id}/vote`, { method: 'POST' })
    } catch {
      // revert
      setVoted(prev)
      setUpvotes((n) => n + (prev ? 1 : -1))
    } finally {
      setVoting(false)
    }
  }

  function handleAnswerSubmitted(answer: TopicAnswer) {
    setAnswers((prev) => [answer, ...prev])
    setShowAnswerForm(false)
    setExpanded(true)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
    >
      {/* Question header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Vote button */}
          <button
            onClick={handleVote}
            disabled={voting}
            aria-label={voted ? 'Remove upvote' : 'Upvote question'}
            className={cn(
              'flex-shrink-0 flex flex-col items-center gap-0.5 pt-0.5 group',
              'text-xs font-mono font-semibold transition-colors disabled:opacity-60',
              voted
                ? 'text-for-400'
                : 'text-surface-500 hover:text-for-400'
            )}
          >
            <ChevronUp
              className={cn(
                'h-5 w-5 transition-transform',
                'group-hover:scale-110',
                voted ? 'text-for-400' : 'text-surface-500 group-hover:text-for-400'
              )}
            />
            <span>{upvotes}</span>
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-snug mb-2">
              {question.content}
            </p>

            <div className="flex items-center gap-3 flex-wrap">
              {question.author && (
                <div className="flex items-center gap-1.5">
                  <Avatar
                    src={question.author.avatar_url}
                    fallback={question.author.display_name || question.author.username}
                    size="xs"
                  />
                  <Link
                    href={`/profile/${question.author.username}`}
                    className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    {question.author.display_name || question.author.username}
                  </Link>
                </div>
              )}
              <span className="text-[10px] font-mono text-surface-600">
                {relativeTime(question.created_at)}
              </span>
              {question.is_answered && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald font-semibold">
                  <Check className="h-2.5 w-2.5" />
                  Answered
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action row */}
        <div className="flex items-center gap-4 mt-3 pl-8">
          {question.answer_count > 0 && (
            <button
              onClick={handleToggle}
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {question.answer_count} {question.answer_count === 1 ? 'answer' : 'answers'}
              {expanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          )}
          <button
            onClick={() => {
              setShowAnswerForm((v) => !v)
              if (!expanded && question.answer_count > 0) handleToggle()
            }}
            className="flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            {showAnswerForm ? 'Cancel' : 'Answer'}
          </button>
        </div>

        {/* Answer form */}
        <AnimatePresence>
          {showAnswerForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="pl-8 overflow-hidden"
            >
              <AnswerForm
                topicId={topicId}
                questionId={question.id}
                onSubmitted={handleAnswerSubmitted}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Answers */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-surface-300"
          >
            <div className="p-4 space-y-3 bg-surface-200/30">
              {loadingAnswers ? (
                <div className="space-y-2">
                  {[0, 1].map((i) => (
                    <div key={i} className="rounded-xl p-3 bg-surface-200/40 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-4/5" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  ))}
                </div>
              ) : answers.length > 0 ? (
                answers.map((a) => <AnswerItem key={a.id} answer={a} />)
              ) : (
                <p className="text-xs font-mono text-surface-500 text-center py-2">
                  No answers yet. Be the first to answer.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Ask form ─────────────────────────────────────────────────────────────────

function AskForm({
  topicId,
  onSubmitted,
}: {
  topicId: string
  onSubmitted: (question: TopicQuestion) => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    const trimmed = text.trim()
    if (trimmed.length < 10) {
      setError('Question must be at least 10 characters.')
      return
    }
    if (!trimmed.endsWith('?')) {
      // soft nudge — not a hard error
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      })
      if (res.status === 401) {
        setError('Sign in to ask a question.')
        return
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Failed to post. Try again.')
        return
      }
      const { question } = await res.json()
      setText('')
      setOpen(false)
      onSubmitted(question)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'w-full flex items-center gap-3 px-5 py-4 rounded-2xl',
          'bg-surface-100 border border-surface-300 border-dashed',
          'text-sm font-mono text-surface-500 hover:text-white hover:border-surface-400',
          'transition-colors text-left'
        )}
      >
        <HelpCircle className="h-4 w-4 flex-shrink-0 text-purple" />
        Ask the community a question about this debate…
      </button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-surface-100 border border-purple/30 p-5 space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-purple" />
          <span className="text-sm font-mono font-semibold text-white">Ask a question</span>
        </div>
        <button
          onClick={() => { setOpen(false); setText(''); setError(null) }}
          className="text-surface-500 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What aspect of this debate do you need clarified? (e.g., 'What does the evidence say about…?')"
        rows={3}
        maxLength={400}
        autoFocus
        className={cn(
          'w-full rounded-xl bg-surface-200 border px-4 py-3',
          'text-sm font-mono text-white placeholder:text-surface-600',
          'resize-none focus:outline-none focus:ring-1 transition-colors',
          error
            ? 'border-against-500/60 focus:ring-against-500/40'
            : 'border-surface-400 focus:border-purple/60 focus:ring-purple/20'
        )}
        aria-label="Your question"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
        }}
      />

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-mono text-surface-600">
          {text.length}/400 · Cmd+Enter to post
        </span>
        <div className="flex items-center gap-2">
          {error && <span className="text-[11px] font-mono text-against-400">{error}</span>}
          <Button
            onClick={handleSubmit}
            disabled={submitting || text.trim().length < 10}
            size="sm"
            className="flex items-center gap-1.5 bg-purple hover:bg-purple/80"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {submitting ? 'Posting…' : 'Post question'}
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Question skeleton ─────────────────────────────────────────────────────────

function QuestionSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-3 w-4" />
        </div>
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AskClient({
  topicId,
  topicStatement,
  topicCategory,
  topicStatus: _topicStatus,
  bluePct,
  totalVotes,
}: AskClientProps) {
  const [questions, setQuestions] = useState<TopicQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sort, setSort] = useState<'top' | 'new'>('top')
  const [filter, setFilter] = useState<'all' | 'unanswered' | 'answered'>('all')

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const res = await fetch(`/api/topics/${topicId}/questions?sort=${sort}&filter=${filter}`)
      if (!res.ok) return
      const json: QuestionsResponse = await res.json()
      setQuestions(json.questions)
    } catch {
      // silent
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [topicId, sort, filter])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  function handleNewQuestion(question: TopicQuestion) {
    setQuestions((prev) => [
      { ...question, author: null, user_voted: false },
      ...prev,
    ])
  }

  const againstPct = 100 - bluePct

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Back */}
        <div className="mb-5">
          <Link
            href={`/topic/${topicId}`}
            className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to debate
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-purple/10 border border-purple/30">
            <HelpCircle className="h-5 w-5 text-purple" />
          </div>
          <div>
            <h1 className="font-mono text-xl font-bold text-white">Ask the Community</h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              Clarifying questions — crowd-sourced answers
            </p>
          </div>
        </div>

        {/* Topic card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 mb-6">
          <p className="text-sm font-semibold text-white leading-snug mb-3">{topicStatement}</p>
          <div className="flex items-center gap-3 flex-wrap">
            {topicCategory && (
              <Badge variant="proposed" className="text-[10px] font-mono">{topicCategory}</Badge>
            )}
            <span className="text-[11px] font-mono text-for-400 font-semibold">{bluePct}% FOR</span>
            <span className="text-[11px] font-mono text-against-400 font-semibold">{againstPct}% AGAINST</span>
            <span className="text-[11px] font-mono text-surface-500">{totalVotes.toLocaleString()} votes</span>
          </div>
        </div>

        {/* Ask form */}
        <div className="mb-6">
          <AskForm topicId={topicId} onSubmitted={handleNewQuestion} />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            {/* Sort */}
            <div className="flex rounded-lg border border-surface-400 overflow-hidden">
              {(['top', 'new'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-mono font-medium transition-colors',
                    sort === s
                      ? 'bg-surface-300 text-white'
                      : 'text-surface-500 hover:text-white'
                  )}
                >
                  {s === 'top' ? 'Top' : 'New'}
                </button>
              ))}
            </div>
            {/* Filter */}
            <div className="flex rounded-lg border border-surface-400 overflow-hidden">
              {(['all', 'unanswered', 'answered'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-mono font-medium transition-colors',
                    filter === f
                      ? 'bg-surface-300 text-white'
                      : 'text-surface-500 hover:text-white'
                  )}
                >
                  {f === 'all' ? 'All' : f === 'unanswered' ? 'Unanswered' : 'Answered'}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh"
            className="text-surface-500 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Questions list */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <QuestionSkeleton key={i} />)}
          </div>
        ) : questions.length === 0 ? (
          <EmptyState
            icon={HelpCircle}
            iconColor="text-purple"
            iconBg="bg-purple/10"
            iconBorder="border-purple/30"
            title={
              filter === 'unanswered'
                ? 'No unanswered questions'
                : filter === 'answered'
                ? 'No answered questions yet'
                : 'No questions yet'
            }
            description={
              filter === 'all'
                ? 'Be the first to ask a clarifying question about this debate.'
                : filter === 'unanswered'
                ? 'All questions have been answered!'
                : 'Answer some questions to help the community.'
            }
            size="md"
          />
        ) : (
          <div className="space-y-3">
            {questions.map((q) => (
              <QuestionCard key={q.id} question={q} topicId={topicId} />
            ))}
          </div>
        )}

        {/* Count footer */}
        {!loading && questions.length > 0 && (
          <p className="text-center text-xs font-mono text-surface-600 mt-6">
            {questions.length} question{questions.length !== 1 ? 's' : ''}
            {filter !== 'all' && ` · filtered by ${filter}`}
          </p>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
