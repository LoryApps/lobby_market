'use client'

/**
 * /questions/[id] — Question Thread
 *
 * Dedicated permalink page for a single civic question. Serves as the
 * landing target for Q&A notifications (qa_question_answered,
 * qa_answer_accepted) so users land directly on the right thread.
 *
 * Shows:
 *   - Question content + author + upvote count
 *   - Topic context chip (links back to /topic/[id]/ask)
 *   - All answers sorted by accepted → most upvoted → newest
 *   - Answer upvoting + best-answer acceptance (question author only)
 *   - Post-answer form for logged-in users
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  HelpCircle,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  ThumbsUp,
  Trophy,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { QuestionDetail, QuestionDetailAnswer } from '@/app/api/questions/[id]/route'

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

const ROLE_BADGE: Record<string, string> = {
  lawmaker:   'text-gold border-gold/40 bg-gold/10',
  senator:    'text-purple border-purple/40 bg-purple/10',
  debater:    'text-emerald border-emerald/40 bg-emerald/10',
  elder:      'text-for-300 border-for-400/40 bg-for-600/10',
  citizen:    'text-surface-500 border-surface-500/40 bg-surface-300/20',
  newcomer:   'text-surface-600 border-surface-600/40 bg-surface-300/10',
}

// ─── Answer Item ──────────────────────────────────────────────────────────────

function AnswerItem({
  answer,
  topicId,
  isQuestionAuthor,
  currentUserId,
  onVote,
  onAccept,
}: {
  answer: QuestionDetailAnswer
  topicId: string
  isQuestionAuthor: boolean
  currentUserId: string | null
  onVote: (answerId: string, voted: boolean, newUpvotes: number) => void
  onAccept: (answerId: string, accepted: boolean) => void
}) {
  const [upvotes, setUpvotes] = useState(answer.upvotes)
  const [userVoted, setUserVoted] = useState(answer.user_voted)
  const [accepted, setAccepted] = useState(answer.is_accepted)
  const [voting, setVoting] = useState(false)
  const [accepting, setAccepting] = useState(false)

  async function handleVote() {
    if (voting || !currentUserId || answer.author_id === currentUserId) return
    setVoting(true)
    const next = !userVoted
    const nextUpvotes = upvotes + (next ? 1 : -1)
    setUserVoted(next)
    setUpvotes(nextUpvotes)
    try {
      const res = await fetch(
        `/api/topics/${topicId}/questions/${answer.question_id}/answers/${answer.id}/vote`,
        { method: 'POST' }
      )
      if (!res.ok) {
        setUserVoted(!next)
        setUpvotes(upvotes)
      } else {
        onVote(answer.id, next, nextUpvotes)
      }
    } catch {
      setUserVoted(!next)
      setUpvotes(upvotes)
    } finally {
      setVoting(false)
    }
  }

  async function handleAccept() {
    if (accepting || !isQuestionAuthor) return
    setAccepting(true)
    const next = !accepted
    setAccepted(next)
    try {
      const res = await fetch(
        `/api/topics/${topicId}/questions/${answer.question_id}/answers/${answer.id}/accept`,
        { method: 'POST' }
      )
      if (!res.ok) {
        setAccepted(!next)
      } else {
        onAccept(answer.id, next)
      }
    } catch {
      setAccepted(!next)
    } finally {
      setAccepting(false)
    }
  }

  const roleBadge = answer.author?.role ? (ROLE_BADGE[answer.author.role] ?? ROLE_BADGE.citizen) : ROLE_BADGE.citizen

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 transition-colors',
        accepted
          ? 'bg-emerald/5 border-emerald/30'
          : 'bg-surface-200/60 border-surface-300/60'
      )}
    >
      {/* Accepted badge */}
      {accepted && (
        <div className="flex items-center gap-1.5 mb-3">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald" />
          <span className="text-[11px] font-mono font-semibold text-emerald uppercase tracking-wide">
            Best Answer
          </span>
        </div>
      )}

      {/* Author */}
      <div className="flex items-center gap-2 mb-3">
        <Link href={`/profile/${answer.author?.username ?? ''}`} className="flex items-center gap-2 min-w-0 group">
          <Avatar
            src={answer.author?.avatar_url ?? null}
            fallback={answer.author?.display_name || answer.author?.username || '?'}
            size="sm"
          />
          <div className="min-w-0">
            <span className="text-xs font-semibold text-white group-hover:text-for-300 transition-colors truncate block">
              {answer.author?.display_name || answer.author?.username || 'Unknown'}
            </span>
            <span className="text-[10px] text-surface-500 font-mono">@{answer.author?.username}</span>
          </div>
        </Link>
        {answer.author?.role && answer.author.role !== 'citizen' && answer.author.role !== 'newcomer' && (
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-mono font-semibold capitalize flex-shrink-0', roleBadge)}>
            {answer.author.role}
          </span>
        )}
        <span className="ml-auto text-[11px] text-surface-600 flex-shrink-0">{relativeTime(answer.created_at)}</span>
      </div>

      {/* Content */}
      <p className="text-sm text-surface-700 leading-relaxed mb-3 whitespace-pre-wrap">
        {answer.content}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleVote}
          disabled={voting || !currentUserId || answer.author_id === currentUserId}
          aria-label={userVoted ? 'Remove upvote' : 'Upvote this answer'}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono font-semibold transition-all',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            userVoted
              ? 'bg-for-500/20 border-for-500/40 text-for-300'
              : 'bg-surface-300/50 border-surface-400/50 text-surface-500 hover:border-for-500/40 hover:text-for-400'
          )}
        >
          {voting ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
          {upvotes}
        </button>

        {isQuestionAuthor && (
          <button
            onClick={handleAccept}
            disabled={accepting}
            aria-label={accepted ? 'Unmark as best answer' : 'Mark as best answer'}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono font-semibold transition-all',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              accepted
                ? 'bg-emerald/20 border-emerald/40 text-emerald'
                : 'bg-surface-300/50 border-surface-400/50 text-surface-500 hover:border-emerald/40 hover:text-emerald'
            )}
          >
            {accepting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            {accepted ? 'Accepted' : 'Accept'}
          </button>
        )}

        {/* Link to full topic Q&A */}
        <Link
          href={`/topic/${topicId}/ask`}
          className="ml-auto text-[11px] text-surface-600 hover:text-surface-500 flex items-center gap-1 transition-colors"
        >
          Full Q&A <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ThreadSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-surface-300/60 bg-surface-200/40 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="rounded-xl border border-surface-300/60 bg-surface-200/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-3 w-full mb-2" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function QuestionThreadClient({ questionId }: { questionId: string }) {
  const [question, setQuestion] = useState<QuestionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [answerContent, setAnswerContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [questionVoted, setQuestionVoted] = useState(false)
  const [questionUpvotes, setQuestionUpvotes] = useState(0)
  const [votingQuestion, setVotingQuestion] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const MAX_ANSWER = 1000

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/questions/${questionId}`)
      if (!res.ok) {
        setError(res.status === 404 ? 'Question not found.' : 'Failed to load question.')
        return
      }
      const data = await res.json()
      setQuestion(data.question)
      setQuestionVoted(data.question.user_voted)
      setQuestionUpvotes(data.question.upvotes)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }, [questionId])

  useEffect(() => {
    load()
    createClient()
      .auth.getUser()
      .then(({ data }) => setCurrentUserId(data.user?.id ?? null))
      .catch(() => {})
  }, [load])

  const handleAnswerVote = useCallback(
    (answerId: string, voted: boolean, newUpvotes: number) => {
      setQuestion((prev) =>
        prev
          ? {
              ...prev,
              answers: prev.answers.map((a) =>
                a.id === answerId ? { ...a, upvotes: newUpvotes, user_voted: voted } : a
              ),
            }
          : prev
      )
    },
    []
  )

  const handleAnswerAccept = useCallback(
    (answerId: string, accepted: boolean) => {
      setQuestion((prev) =>
        prev
          ? {
              ...prev,
              is_answered: accepted || prev.answers.some((a) => a.id !== answerId && a.is_accepted),
              answers: prev.answers.map((a) =>
                a.id === answerId ? { ...a, is_accepted: accepted } : accepted ? { ...a, is_accepted: false } : a
              ),
            }
          : prev
      )
    },
    []
  )

  async function handleQuestionVote() {
    if (votingQuestion || !currentUserId || !question || question.author_id === currentUserId) return
    setVotingQuestion(true)
    const next = !questionVoted
    const nextUpvotes = questionUpvotes + (next ? 1 : -1)
    setQuestionVoted(next)
    setQuestionUpvotes(nextUpvotes)
    try {
      const res = await fetch(
        `/api/topics/${question.topic_id}/questions/${question.id}/vote`,
        { method: 'POST' }
      )
      if (!res.ok) {
        setQuestionVoted(!next)
        setQuestionUpvotes(questionUpvotes)
      }
    } catch {
      setQuestionVoted(!next)
      setQuestionUpvotes(questionUpvotes)
    } finally {
      setVotingQuestion(false)
    }
  }

  async function handleSubmitAnswer(e: React.FormEvent) {
    e.preventDefault()
    if (!currentUserId || !question || !answerContent.trim() || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(
        `/api/topics/${question.topic_id}/questions/${question.id}/answers`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: answerContent.trim() }),
        }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSubmitError(err.error ?? 'Failed to post answer.')
        return
      }
      setAnswerContent('')
      await load()
    } catch {
      setSubmitError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const isQuestionAuthor = currentUserId === question?.author_id
  const hasAlreadyAnswered = question?.answers.some((a) => a.author_id === currentUserId)
  const remaining = MAX_ANSWER - answerContent.length

  // ─── Topic status helpers ─────────────────────────────────────────────────
  const topicStatus = question?.topic?.status ?? 'active'
  const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
    proposed: 'proposed', active: 'active', voting: 'active', law: 'law', failed: 'failed',
  }
  const STATUS_LABEL: Record<string, string> = {
    proposed: 'Proposed', active: 'Active', voting: 'Voting', law: 'LAW', failed: 'Failed',
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/questions"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors flex-shrink-0"
            aria-label="Back to questions hub"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-for-500/10 border border-for-500/30">
              <HelpCircle className="h-4.5 w-4.5 text-for-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">Question Thread</h1>
              <p className="text-[11px] text-surface-500">Community Q&amp;A</p>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <ThreadSkeleton />
        ) : error ? (
          <div className="rounded-xl border border-against-500/30 bg-against-600/10 p-6 text-center">
            <p className="text-sm text-against-400 mb-4">{error}</p>
            <Button variant="secondary" size="sm" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try again
            </Button>
          </div>
        ) : question ? (
          <div className="space-y-4">

            {/* Topic context */}
            {question.topic && (
              <Link
                href={`/topic/${question.topic.id}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-surface-500 font-mono uppercase tracking-wide mb-0.5">
                    Topic
                  </p>
                  <p className="text-xs font-semibold text-white group-hover:text-for-300 transition-colors truncate">
                    {question.topic.statement}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {question.topic.category && (
                      <span className="text-[10px] text-surface-500">{question.topic.category}</span>
                    )}
                    <span className="text-[10px] text-surface-600">·</span>
                    <span className="text-[10px] text-surface-500">
                      {Math.round(question.topic.blue_pct ?? 50)}% For
                    </span>
                    <span className="text-[10px] text-surface-600">·</span>
                    <span className="text-[10px] text-surface-500">
                      {(question.topic.total_votes ?? 0).toLocaleString()} votes
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={STATUS_BADGE[topicStatus] ?? 'active'} size="xs">
                    {STATUS_LABEL[topicStatus] ?? topicStatus}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 transition-colors" />
                </div>
              </Link>
            )}

            {/* Question card */}
            <div className="rounded-xl border border-for-500/20 bg-for-600/5 p-5">
              {/* Status badges */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {question.is_answered && (
                  <span className="flex items-center gap-1 text-[10px] font-mono font-semibold text-emerald bg-emerald/10 border border-emerald/30 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="h-3 w-3" /> Answered
                  </span>
                )}
                <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500 bg-surface-300/40 border border-surface-400/30 px-2 py-0.5 rounded-full">
                  <MessageSquare className="h-3 w-3" />
                  {question.answer_count} {question.answer_count === 1 ? 'answer' : 'answers'}
                </span>
                <span className="ml-auto text-[11px] text-surface-500">{relativeTime(question.created_at)}</span>
              </div>

              {/* Question text */}
              <p className="text-base font-medium text-white leading-relaxed mb-4 whitespace-pre-wrap">
                {question.content}
              </p>

              {/* Author + vote */}
              <div className="flex items-center gap-3">
                <Link href={`/profile/${question.author?.username ?? ''}`} className="flex items-center gap-2 min-w-0 group">
                  <Avatar
                    src={question.author?.avatar_url ?? null}
                    fallback={question.author?.display_name || question.author?.username || '?'}
                    size="xs"
                  />
                  <span className="text-[11px] text-surface-500 group-hover:text-surface-400 transition-colors truncate">
                    {question.author?.display_name || question.author?.username || 'Unknown'}
                  </span>
                </Link>

                <button
                  onClick={handleQuestionVote}
                  disabled={votingQuestion || !currentUserId || question.author_id === currentUserId}
                  aria-label={questionVoted ? 'Remove upvote' : 'Upvote this question'}
                  className={cn(
                    'ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono font-semibold transition-all',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                    questionVoted
                      ? 'bg-for-500/20 border-for-500/40 text-for-300'
                      : 'bg-surface-300/50 border-surface-400/50 text-surface-500 hover:border-for-500/40 hover:text-for-400'
                  )}
                >
                  {votingQuestion ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
                  {questionUpvotes}
                </button>

                <Link
                  href={`/topic/${question.topic_id}/ask`}
                  className="flex items-center gap-1 text-[11px] text-surface-600 hover:text-for-400 transition-colors"
                  aria-label="View all questions for this topic"
                >
                  All Q&amp;A <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Answers section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-3.5 w-3.5 text-gold" />
                <h2 className="text-sm font-semibold text-white">
                  {question.answers.length > 0
                    ? `${question.answers.length} Answer${question.answers.length !== 1 ? 's' : ''}`
                    : 'No answers yet'}
                </h2>
                {question.answers.length > 0 && (
                  <span className="text-[10px] text-surface-500 ml-auto">
                    sorted by accepted → most upvoted
                  </span>
                )}
              </div>

              {question.answers.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="No answers yet"
                  description="Be the first to answer this civic question."
                />
              ) : (
                <div className="space-y-3">
                  {question.answers.map((answer, i) => (
                    <motion.div
                      key={answer.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <AnswerItem
                        answer={answer}
                        topicId={question.topic_id}
                        isQuestionAuthor={isQuestionAuthor}
                        currentUserId={currentUserId}
                        onVote={handleAnswerVote}
                        onAccept={handleAnswerAccept}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Post answer form */}
            {currentUserId ? (
              !hasAlreadyAnswered ? (
                <form onSubmit={handleSubmitAnswer} className="space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Send className="h-3.5 w-3.5 text-for-400" />
                    <h3 className="text-sm font-semibold text-white">Your Answer</h3>
                  </div>

                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      value={answerContent}
                      onChange={(e) => setAnswerContent(e.target.value)}
                      placeholder="Share your civic knowledge or perspective…"
                      rows={4}
                      maxLength={MAX_ANSWER}
                      aria-label="Your answer"
                      className={cn(
                        'w-full resize-none rounded-xl px-4 py-3 text-sm',
                        'bg-surface-200 border border-surface-300',
                        'text-white placeholder:text-surface-500',
                        'focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/20',
                        'transition-colors'
                      )}
                    />
                    <span
                      className={cn(
                        'absolute bottom-2.5 right-3 text-[10px] font-mono',
                        remaining < 100 ? 'text-against-400' : 'text-surface-600'
                      )}
                    >
                      {remaining}
                    </span>
                  </div>

                  {submitError && (
                    <p className="text-xs text-against-400">{submitError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || answerContent.trim().length < 10}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all',
                      'border',
                      submitting || answerContent.trim().length < 10
                        ? 'bg-surface-300/50 border-surface-400/50 text-surface-600 cursor-not-allowed'
                        : 'bg-for-600/80 border-for-500/50 text-white hover:bg-for-600'
                    )}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Post Answer
                  </button>
                </form>
              ) : (
                <div className="rounded-xl border border-emerald/20 bg-emerald/5 p-4 text-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald mx-auto mb-2" />
                  <p className="text-sm text-emerald/80">You&apos;ve already answered this question.</p>
                </div>
              )
            ) : (
              <div className="rounded-xl border border-surface-300/60 bg-surface-200/40 p-5 text-center">
                <Users className="h-5 w-5 text-surface-500 mx-auto mb-2" />
                <p className="text-sm text-surface-500 mb-3">Sign in to answer this question.</p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-for-600/80 border border-for-500/50 text-white text-sm font-semibold hover:bg-for-600 transition-colors"
                >
                  Sign in <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}

            {/* Navigation links */}
            <div className="flex items-center justify-between pt-2 border-t border-surface-300/40">
              <Link
                href="/questions"
                className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-400 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                All Questions
              </Link>
              {question.topic && (
                <Link
                  href={`/topic/${question.topic.id}/ask`}
                  className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-for-400 transition-colors"
                >
                  More Q&amp;A for this topic
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>

          </div>
        ) : null}
      </main>

      <BottomNav />
    </div>
  )
}
