'use client'

/**
 * /ama/[id] — Individual AMA session page
 *
 * Shows session details, host info, and the live Q&A thread.
 * Community members can submit questions and upvote others.
 * The host can answer questions directly from this view.
 *
 * Refreshes every 30s when session is live so new questions appear.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Bell,
  BellOff,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  MessageSquare,
  Mic,
  Pin,
  RefreshCw,
  Send,
  ThumbsUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { AMASessionDetail, AMAQuestion } from '@/app/api/ama/[id]/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  return `${Math.floor(ms / 86_400_000)}d ago`
}

// ─── Question card ────────────────────────────────────────────────────────────

function QuestionCard({
  question,
  isHost,
  onUpvote,
  onAnswer,
}: {
  question: AMAQuestion
  isHost: boolean
  onUpvote: (id: string) => void
  onAnswer: (id: string, content: string) => Promise<void>
}) {
  const [voted, setVoted] = useState(question.user_voted)
  const [upvotes, setUpvotes] = useState(question.upvotes)
  const [busy, setBusy] = useState(false)
  const [showAnswerBox, setShowAnswerBox] = useState(false)
  const [answerText, setAnswerText] = useState(question.answer?.content ?? '')
  const [savingAnswer, setSavingAnswer] = useState(false)

  async function handleUpvote() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(
        `/api/ama/${question.session_id}/questions/${question.id}/upvote`,
        { method: 'POST' }
      )
      if (res.ok) {
        const data = await res.json() as { voted: boolean }
        setVoted(data.voted)
        setUpvotes((v) => v + (data.voted ? 1 : -1))
        onUpvote(question.id)
      }
    } catch {
      // silent
    } finally {
      setBusy(false)
    }
  }

  async function submitAnswer(e: React.FormEvent) {
    e.preventDefault()
    if (!answerText.trim() || savingAnswer) return
    setSavingAnswer(true)
    try {
      await onAnswer(question.id, answerText.trim())
      setShowAnswerBox(false)
    } finally {
      setSavingAnswer(false)
    }
  }

  const isAnswered = question.is_answered || !!question.answer

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 space-y-3',
        question.is_pinned
          ? 'bg-gold/5 border-gold/30'
          : isAnswered
          ? 'bg-surface-100 border-surface-200'
          : 'bg-surface-100 border-surface-300',
      )}
    >
      {/* Pin badge */}
      {question.is_pinned && (
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-gold">
          <Pin className="h-3 w-3" />
          Pinned by host
        </div>
      )}

      {/* Question content */}
      <p className="text-sm text-white leading-relaxed">{question.content}</p>

      {/* Author + meta */}
      <div className="flex items-center gap-2">
        <Avatar
          src={question.author?.avatar_url ?? null}
          fallback={question.author?.display_name || question.author?.username || '?'}
          size="xs"
        />
        <span className="text-xs font-mono text-surface-500">
          @{question.author?.username ?? 'anonymous'}
        </span>
        <span className="text-xs font-mono text-surface-600 ml-auto">{timeAgo(question.created_at)}</span>
      </div>

      {/* Answer */}
      {question.answer && (
        <div className="ml-3 pl-3 border-l-2 border-for-600/50 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-for-400">
            <CheckCircle2 className="h-3 w-3" />
            Host answer
          </div>
          <p className="text-sm text-surface-300 leading-relaxed">{question.answer.content}</p>
          <p className="text-[11px] font-mono text-surface-600">{timeAgo(question.answer.created_at)}</p>
        </div>
      )}

      {/* Host answer form */}
      {isHost && showAnswerBox && (
        <form onSubmit={submitAnswer} className="space-y-2 ml-3 pl-3 border-l-2 border-for-600/40">
          <textarea
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            placeholder="Write your answer…"
            maxLength={1200}
            rows={4}
            autoFocus
            className="w-full bg-surface-200 border border-surface-300 rounded-lg px-3 py-2 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-for-500/60 transition-colors resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-surface-600">{answerText.length}/1200</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAnswerBox(false)}
                className="px-3 py-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingAnswer || answerText.trim().length < 10}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-for-600 hover:bg-for-500 text-white text-xs font-mono font-semibold transition-colors disabled:opacity-50"
              >
                {savingAnswer ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                {savingAnswer ? 'Saving…' : 'Post Answer'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Actions row */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleUpvote}
          disabled={busy}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-all',
            voted
              ? 'bg-for-600/20 border-for-600/40 text-for-400'
              : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
            'disabled:opacity-50',
          )}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
          {upvotes}
        </button>

        {isAnswered && (
          <span className="flex items-center gap-1 text-[11px] font-mono text-emerald">
            <CheckCircle2 className="h-3 w-3" />
            Answered
          </span>
        )}

        {isHost && !showAnswerBox && (
          <button
            onClick={() => setShowAnswerBox(true)}
            className="ml-auto flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
          >
            {question.answer ? 'Edit answer' : 'Answer this'}
            <ChevronDown className="h-3 w-3" />
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function QuestionSkeleton() {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AMASessionPage() {
  const params = useParams<{ id: string }>()
  const sessionId = params.id

  const [data, setData] = useState<AMASessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [question, setQuestion] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const [rsvped, setRsvped] = useState(false)
  const [rsvpBusy, setRsvpBusy] = useState(false)

  const [sortBy, setSortBy] = useState<'top' | 'new'>('top')
  const [filter, setFilter] = useState<'all' | 'unanswered'>('all')

  const [userId, setUserId] = useState<string | null>(null)
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch session data
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/ama/${sessionId}`)
      if (!res.ok) {
        if (res.status === 404) setError('Session not found')
        else setError('Failed to load session')
        return
      }
      const d = await res.json() as AMASessionDetail
      setData(d)
      setRsvped(d.user_rsvped)
    } catch {
      setError('Failed to load session')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    void fetchData()

    // Fetch current user
    fetch('/api/me/setup')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.profile?.id) setUserId(d.profile.id as string)
      })
      .catch(() => {})
  }, [fetchData])

  // Auto-refresh for live sessions
  useEffect(() => {
    if (!data) return
    if (data.status === 'live') {
      refreshRef.current = setInterval(() => void fetchData(), 30_000)
    }
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current)
    }
  }, [data, fetchData])

  async function submitQuestion(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    if (!question.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/ama/${sessionId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: question.trim() }),
      })
      const body = await res.json() as { question?: AMAQuestion; error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Failed to submit')
      setQuestion('')
      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 3000)
      void fetchData()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit question')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpvote(_id: string) {
    void fetchData()
  }

  async function handleAnswer(qid: string, content: string) {
    const res = await fetch(`/api/ama/${sessionId}/questions/${qid}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    if (!res.ok) {
      const body = await res.json() as { error?: string }
      throw new Error(body.error ?? 'Failed to post answer')
    }
    void fetchData()
  }

  async function handleRsvp() {
    if (rsvpBusy) return
    setRsvpBusy(true)
    try {
      const res = await fetch(`/api/ama/${sessionId}/rsvp`, { method: 'POST' })
      if (res.ok) {
        const body = await res.json() as { rsvped: boolean }
        setRsvped(body.rsvped)
      }
    } finally {
      setRsvpBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-6 pb-28">
          <Skeleton className="h-4 w-24 mb-6" />
          <Skeleton className="h-8 w-3/4 mb-3" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-5/6 mb-6" />
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <QuestionSkeleton key={i} />)}
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-6 pb-28">
          <EmptyState
            icon={Mic}
            title={error ?? 'Session not found'}
            description="This AMA session may have been removed or doesn't exist."
            action={{ label: 'Browse sessions', href: '/ama' }}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  const isLive = data.status === 'live'
  const isUpcoming = data.status === 'upcoming'
  const isEnded = data.status === 'ended'
  const isHost = userId === data.host_id

  // Filter + sort questions
  let questions = data.questions
  if (filter === 'unanswered') questions = questions.filter((q) => !q.is_answered)
  if (sortBy === 'new') questions = [...questions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  else questions = [...questions].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
    return b.upvotes - a.upvotes
  })

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Back */}
        <Link
          href="/ama"
          className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors mb-5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          AMA Sessions
        </Link>

        {/* Session header card */}
        <div className={cn(
          'rounded-2xl border p-5 mb-5',
          isLive ? 'bg-for-950/30 border-for-600/40' : 'bg-surface-100 border-surface-300',
        )}>
          {/* Status badge */}
          <div className="flex items-center gap-2 mb-3">
            {isLive && (
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-for-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-for-500" />
                </span>
                <span className="text-xs font-mono font-semibold text-for-400 uppercase tracking-wider">Live Now</span>
              </div>
            )}
            {isUpcoming && (
              <span className="flex items-center gap-1 text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
                <Calendar className="h-3 w-3" />
                Upcoming
              </span>
            )}
            {isEnded && (
              <span className="flex items-center gap-1 text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
                <Clock className="h-3 w-3" />
                Ended
              </span>
            )}
            {data.category && (
              <span className="ml-auto text-xs font-mono text-surface-500 bg-surface-200 border border-surface-300 px-2 py-0.5 rounded-full">
                {data.category}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="font-mono text-xl font-bold text-white leading-snug mb-2">
            {data.title}
          </h1>

          {/* Description */}
          {data.description && (
            <p className="text-sm text-surface-400 leading-relaxed mb-4">{data.description}</p>
          )}

          {/* Host */}
          {data.host && (
            <div className="flex items-center gap-2.5 mb-4">
              <Avatar
                src={data.host.avatar_url}
                fallback={data.host.display_name || data.host.username}
                size="sm"
              />
              <div className="min-w-0">
                <p className="text-sm font-mono font-semibold text-white">
                  {data.host.display_name || data.host.username}
                  {isHost && <span className="ml-2 text-[10px] text-for-400 bg-for-950/40 border border-for-700/40 px-1.5 py-0.5 rounded font-normal">You</span>}
                </p>
                <p className="text-xs font-mono text-surface-500">@{data.host.username} · Host</p>
              </div>
              <Link
                href={`/profile/${data.host.username}`}
                className="ml-auto text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
              >
                View profile
              </Link>
            </div>
          )}

          {/* Scheduled time */}
          <div className="flex items-center gap-2 text-xs font-mono text-surface-500 mb-4">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {isLive && data.started_at
                ? `Started ${formatTime(data.started_at)}`
                : isEnded && data.ended_at
                ? `Ended ${formatDate(data.ended_at)}`
                : `Scheduled ${formatDate(data.scheduled_at)} at ${formatTime(data.scheduled_at)}`}
            </span>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs font-mono text-surface-500 pt-3 border-t border-surface-300">
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {data.question_count} questions
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald" />
              {data.answer_count} answered
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {data.rsvp_count} attending
            </span>

            {/* RSVP button */}
            {isUpcoming && (
              <button
                onClick={handleRsvp}
                disabled={rsvpBusy}
                className={cn(
                  'ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-mono font-semibold transition-all disabled:opacity-50',
                  rsvped
                    ? 'bg-for-600/20 border-for-600/40 text-for-400'
                    : 'bg-for-600 border-for-500 text-white hover:bg-for-500',
                )}
              >
                {rsvpBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : rsvped ? <BellOff className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
                {rsvped ? 'Cancel RSVP' : 'RSVP'}
              </button>
            )}

            {/* Refresh for live */}
            {isLive && (
              <button
                onClick={() => void fetchData()}
                className="ml-auto flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </button>
            )}
          </div>
        </div>

        {/* Submit question form */}
        {(isLive || isUpcoming) && !isHost && userId && (
          <form onSubmit={submitQuestion} className="mb-5 bg-surface-100 border border-surface-300 rounded-xl p-4 space-y-3">
            <label className="block text-xs font-mono text-surface-400 font-semibold uppercase tracking-wider">
              Submit a question
            </label>
            <div className="relative">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What would you like to ask the expert?"
                maxLength={300}
                rows={2}
                className="w-full bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-for-500/60 transition-colors resize-none pr-16"
              />
              <span className="absolute bottom-2.5 right-3 text-[11px] font-mono text-surface-600">
                {question.length}/300
              </span>
            </div>
            {submitError && (
              <p className="text-xs font-mono text-against-400">{submitError}</p>
            )}
            <div className="flex items-center justify-between">
              <p className="text-xs font-mono text-surface-600">
                Top-upvoted questions get answered first
              </p>
              <button
                type="submit"
                disabled={submitting || question.trim().length < 10}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-xs font-mono font-semibold transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : submitted ? <Check className="h-3 w-3" /> : <Send className="h-3 w-3" />}
                {submitting ? 'Submitting…' : submitted ? 'Submitted!' : 'Submit'}
              </button>
            </div>
          </form>
        )}

        {/* Questions section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-sm font-semibold text-surface-400 uppercase tracking-wider">
              Questions ({data.question_count})
            </h2>

            {/* Sort + filter controls */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-surface-100 border border-surface-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setSortBy('top')}
                  className={cn(
                    'px-2.5 py-1 text-[11px] font-mono transition-colors',
                    sortBy === 'top' ? 'bg-surface-200 text-white' : 'text-surface-500 hover:text-white',
                  )}
                >
                  Top
                </button>
                <button
                  onClick={() => setSortBy('new')}
                  className={cn(
                    'px-2.5 py-1 text-[11px] font-mono transition-colors',
                    sortBy === 'new' ? 'bg-surface-200 text-white' : 'text-surface-500 hover:text-white',
                  )}
                >
                  New
                </button>
              </div>
              <button
                onClick={() => setFilter(filter === 'all' ? 'unanswered' : 'all')}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all',
                  filter === 'unanswered'
                    ? 'bg-surface-200 border-surface-400 text-white'
                    : 'border-surface-300 text-surface-500 hover:text-white',
                )}
              >
                {filter === 'unanswered' ? 'Unanswered only' : 'All'}
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {questions.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <EmptyState
                  icon={MessageSquare}
                  size="sm"
                  title={filter === 'unanswered' ? 'All questions answered!' : 'No questions yet'}
                  description={
                    filter === 'unanswered'
                      ? 'The host has answered every question.'
                      : isUpcoming
                      ? 'Be the first to submit a question before the session starts.'
                      : isLive
                      ? 'The session is live — ask the first question!'
                      : 'No questions were submitted during this session.'
                  }
                />
              </motion.div>
            ) : (
              <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                {questions.map((q) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    isHost={isHost}
                    onUpvote={handleUpvote}
                    onAnswer={handleAnswer}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
