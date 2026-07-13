'use client'

/**
 * /pmqs — Prime Minister's Questions
 *
 * The weekly civic chamber where the ruling coalition leader (PM) answers
 * questions submitted and upvoted by citizens.
 *
 * Flow:
 *   1. Citizens submit one question per session (max 280 chars).
 *   2. All citizens can upvote questions — top questions get answered.
 *   3. The PM (or their proxy) answers selected questions in writing.
 *   4. Session closes; archive is publicly browsable.
 *
 * Related pages:
 *   /government    — the ruling coalition dashboard
 *   /parliament    — full parliamentary hub
 *   /opposition    — the shadow cabinet
 *   /confidence    — motion of no confidence
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Crown,
  HelpCircle,
  Loader2,
  Mic,
  RefreshCw,
  Scale,
  Send,
  ThumbsUp,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { PmqsResponse, PmqSession } from '@/app/api/pmqs/route'
import type { QuestionsResponse, PmqQuestion } from '@/app/api/pmqs/[sessionId]/questions/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCountdown(target: string): string {
  const diff = Math.max(0, new Date(target).getTime() - Date.now())
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  const mins = Math.floor((diff % 3_600_000) / 60_000)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const CATEGORIES = [
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Law',
  'Environment',
  'Culture',
  'Education',
]

// ─── Status badge ─────────────────────────────────────────────────────────────

function SessionStatusBadge({ status }: { status: PmqSession['status'] }) {
  const map = {
    open: { label: 'Open', cls: 'bg-emerald/10 text-emerald border-emerald/30' },
    in_progress: { label: 'Live', cls: 'bg-for-500/10 text-for-300 border-for-500/30' },
    closed: { label: 'Closed', cls: 'bg-surface-300/20 text-surface-500 border-surface-400/30' },
    archived: { label: 'Archived', cls: 'bg-surface-300/10 text-surface-600 border-surface-400/20' },
  }
  const { label, cls } = map[status] ?? map.archived
  return (
    <span className={cn('text-xs font-mono px-2 py-0.5 rounded-full border', cls)}>
      {label}
    </span>
  )
}

// ─── Question Card ─────────────────────────────────────────────────────────────

interface QuestionCardProps {
  q: PmqQuestion
  hasVoted: boolean
  isOwn: boolean
  sessionOpen: boolean
  onVote: (id: string) => void
  rank: number
}

function QuestionCard({ q, hasVoted, isOwn, sessionOpen, onVote, rank }: QuestionCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative rounded-xl border bg-surface-100/60 backdrop-blur-sm overflow-hidden',
        q.status === 'answered' && 'border-emerald/30 bg-emerald/5',
        q.status === 'selected' && 'border-gold/30 bg-gold/5',
        q.status === 'pending' && 'border-surface-300/60',
        q.status === 'skipped' && 'border-surface-300/20 opacity-60',
      )}
    >
      {/* Rank badge */}
      <div className="absolute top-3 left-3 flex items-center justify-center h-6 w-6 rounded-full bg-surface-200 border border-surface-300/60">
        <span className="text-[10px] font-mono text-surface-500">#{rank}</span>
      </div>

      <div className="p-4 pl-11">
        {/* Question text */}
        <p className="text-sm text-white leading-relaxed font-medium mb-3">{q.question}</p>

        {/* Answer (if answered) */}
        {q.answer && (
          <div className="mb-3">
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1.5 text-xs text-emerald hover:text-emerald/80 transition-colors font-mono"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Hide PM response' : 'View PM response'}
            </button>
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 p-3 rounded-lg bg-emerald/5 border border-emerald/20"
                >
                  <p className="text-xs text-surface-700 leading-relaxed">{q.answer.answer}</p>
                  <p className="text-[10px] text-surface-500 font-mono mt-1.5">
                    Answered {formatDate(q.answer.created_at)}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Asker */}
          <div className="flex items-center gap-1.5">
            <Avatar
              src={q.asker?.avatar_url ?? null}
              username={q.asker?.username ?? '?'}
              size="xs"
            />
            <span className="text-xs text-surface-500 font-mono">
              @{q.asker?.username ?? 'unknown'}
            </span>
          </div>

          {/* Category */}
          {q.category && (
            <Badge variant="ghost" size="sm" className="text-[10px]">
              {q.category}
            </Badge>
          )}

          {/* Status */}
          {q.status !== 'pending' && (
            <span className={cn(
              'text-[10px] font-mono px-1.5 py-0.5 rounded-full border',
              q.status === 'answered' && 'text-emerald border-emerald/30 bg-emerald/10',
              q.status === 'selected' && 'text-gold border-gold/30 bg-gold/10',
              q.status === 'skipped' && 'text-surface-500 border-surface-400/30',
            )}>
              {q.status}
            </span>
          )}

          {/* Spacer */}
          <span className="flex-1" />

          {/* Upvote button */}
          <button
            onClick={() => !isOwn && sessionOpen && onVote(q.id)}
            disabled={isOwn || !sessionOpen}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition-all',
              hasVoted
                ? 'bg-for-500/20 text-for-300 border-for-500/40'
                : 'bg-surface-200 text-surface-500 border-surface-300/60 hover:bg-surface-300 hover:text-white',
              (isOwn || !sessionOpen) && 'opacity-50 cursor-not-allowed',
            )}
            title={isOwn ? 'Your question' : sessionOpen ? 'Upvote this question' : 'Session closed'}
          >
            <ThumbsUp className={cn('h-3 w-3', hasVoted && 'fill-for-400')} />
            <span>{q.upvotes}</span>
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Submit question form ──────────────────────────────────────────────────────

interface SubmitFormProps {
  sessionId: string
  onSubmitted: () => void
  onCancel: () => void
}

function SubmitForm({ sessionId, onSubmitted, onCancel }: SubmitFormProps) {
  const [question, setQuestion] = useState('')
  const [category, setCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const submit = useCallback(async () => {
    const trimmed = question.trim()
    if (trimmed.length < 10) {
      setError('Question must be at least 10 characters.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/pmqs/${sessionId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed, category: category || null }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to submit question.')
        return
      }
      onSubmitted()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [question, category, sessionId, onSubmitted])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      className="rounded-xl border border-for-500/30 bg-for-500/5 p-5 mb-6"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-for-500/10 border border-for-500/30">
            <Mic className="h-4 w-4 text-for-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Submit your question</p>
            <p className="text-xs text-surface-500">One question per session — make it count</p>
          </div>
        </div>
        <button onClick={onCancel} className="text-surface-500 hover:text-white transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="What would you ask the Prime Minister? Be direct and specific."
        maxLength={280}
        rows={3}
        className={cn(
          'w-full bg-surface-200/60 border border-surface-300/60 rounded-lg px-3 py-2.5',
          'text-sm text-white placeholder:text-surface-500 resize-none',
          'focus:outline-none focus:border-for-500/50 focus:ring-1 focus:ring-for-500/30',
          'transition-colors',
        )}
      />
      <div className="flex items-center justify-between mt-1 mb-3">
        <span className={cn(
          'text-[10px] font-mono',
          question.length > 250 ? 'text-against-400' : 'text-surface-500',
        )}>
          {question.length}/280
        </span>
      </div>

      {/* Category */}
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="w-full bg-surface-200/60 border border-surface-300/60 rounded-lg px-3 py-2 text-sm text-white mb-4 focus:outline-none focus:border-for-500/50"
      >
        <option value="">Category (optional)</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {error && (
        <div className="flex items-center gap-2 text-xs text-against-400 bg-against-500/10 border border-against-500/30 rounded-lg px-3 py-2 mb-3">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 rounded-lg bg-surface-200 border border-surface-300/60 text-sm text-surface-500 hover:text-white hover:bg-surface-300 transition-all"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={submitting || question.trim().length < 10}
          className={cn(
            'flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2',
            'bg-for-500 text-white hover:bg-for-400',
            (submitting || question.trim().length < 10) && 'opacity-50 cursor-not-allowed',
          )}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? 'Submitting…' : 'Submit question'}
        </button>
      </div>
    </motion.div>
  )
}

// ─── Session card (archive) ───────────────────────────────────────────────────

function PastSessionCard({ s }: { s: PmqSession }) {
  return (
    <div className="rounded-xl border border-surface-300/40 bg-surface-100/40 p-4 hover:border-surface-300/60 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <SessionStatusBadge status={s.status} />
            <span className="text-xs text-surface-500 font-mono">Session #{s.session_number}</span>
          </div>
          <p className="text-sm font-medium text-white truncate">{s.title}</p>
          {s.pm_profile && (
            <div className="flex items-center gap-1.5 mt-1">
              <Crown className="h-3 w-3 text-gold" />
              <span className="text-xs text-surface-500">PM: @{s.pm_profile.username}</span>
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-surface-500 font-mono">{formatDate(s.created_at)}</p>
          <p className="text-xs text-surface-600 mt-0.5">
            {s.question_count ?? 0} Q · {s.answered_count ?? 0} answered
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PmqsClient() {
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<PmqsResponse | null>(null)

  const [questionsLoading, setQuestionsLoading] = useState(false)
  const [questionsData, setQuestionsData] = useState<QuestionsResponse | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [_votingId, setVotingId] = useState<string | null>(null)

  const [tab, setTab] = useState<'top' | 'new' | 'answered'>('top')

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pmqs')
      if (res.ok) setSessions(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchQuestions = useCallback(async (sessionId: string) => {
    setQuestionsLoading(true)
    try {
      const res = await fetch(`/api/pmqs/${sessionId}/questions`)
      if (res.ok) setQuestionsData(await res.json())
    } finally {
      setQuestionsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  useEffect(() => {
    const id = sessions?.current?.id ?? null
    setSelectedSessionId(id)
    if (id) fetchQuestions(id)
  }, [sessions, fetchQuestions])

  const handleVote = useCallback(async (questionId: string) => {
    if (!questionsData) return
    setVotingId(questionId)
    try {
      const res = await fetch('/api/pmqs/questions/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId }),
      })
      if (!res.ok) return
      const { voted } = await res.json()

      setQuestionsData((prev) => {
        if (!prev) return prev
        const myVotes = voted
          ? [...prev.my_votes, questionId]
          : prev.my_votes.filter((id) => id !== questionId)
        const questions = prev.questions.map((q) =>
          q.id === questionId
            ? { ...q, upvotes: q.upvotes + (voted ? 1 : -1) }
            : q
        )
        return { ...prev, my_votes: myVotes, questions }
      })
    } finally {
      setVotingId(null)
    }
  }, [questionsData])

  const handleSubmitted = useCallback(() => {
    setShowForm(false)
    if (selectedSessionId) fetchQuestions(selectedSessionId)
  }, [selectedSessionId, fetchQuestions])

  const currentSession = sessions?.current
  const isOpen = currentSession?.status === 'open' || currentSession?.status === 'in_progress'
  const pastDeadline = currentSession
    ? new Date(currentSession.questions_due_at) < new Date()
    : false
  const canSubmit = isOpen && !pastDeadline && !questionsData?.my_question_id

  // Filtered + sorted questions
  const allQuestions = questionsData?.questions ?? []
  const displayQuestions = (() => {
    if (tab === 'top') return [...allQuestions].sort((a, b) => b.upvotes - a.upvotes)
    if (tab === 'new') return [...allQuestions].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    if (tab === 'answered') return allQuestions.filter((q) => q.status === 'answered')
    return allQuestions
  })()

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/parliament"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300/60 text-surface-500 hover:text-white hover:bg-surface-300 transition-all"
            aria-label="Back to Parliament"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30">
            <HelpCircle className="h-5 w-5 text-gold" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Prime Minister&apos;s Questions
            </h1>
            <p className="text-xs text-surface-500 font-mono">
              Hold the government to account — weekly civic Q&A
            </p>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : !currentSession ? (
          /* No open session */
          <div className="mb-8">
            <div className="rounded-xl border border-surface-300/40 bg-surface-100/60 p-8 text-center mb-6">
              <Scale className="h-10 w-10 text-surface-500 mx-auto mb-3" />
              <p className="text-base font-semibold text-white mb-1">No active PMQ session</p>
              <p className="text-sm text-surface-500 mb-4">
                The Prime Minister has not yet opened a Q&A session. Check back soon.
              </p>
              <Link
                href="/government"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold/10 border border-gold/30 text-sm text-gold hover:bg-gold/20 transition-all"
              >
                <Crown className="h-4 w-4" />
                View the Government
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          /* Active session */
          <div className="mb-8">
            {/* Session banner */}
            <div className="rounded-xl border border-gold/30 bg-gold/5 p-5 mb-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <SessionStatusBadge status={currentSession.status} />
                    <span className="text-xs text-surface-500 font-mono">
                      Session #{currentSession.session_number}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-white mb-1">{currentSession.title}</h2>
                  {currentSession.pm_profile ? (
                    <div className="flex items-center gap-2">
                      <Avatar
                        src={currentSession.pm_profile.avatar_url}
                        username={currentSession.pm_profile.username}
                        size="xs"
                      />
                      <span className="text-xs text-surface-500">
                        PM: <span className="text-gold font-mono">@{currentSession.pm_profile.username}</span>
                      </span>
                      {currentSession.coalition && (
                        <span className="text-xs text-surface-600">
                          · {currentSession.coalition.name}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-surface-500">Awaiting PM assignment</p>
                  )}
                </div>

                {/* Timing */}
                <div className="text-right flex-shrink-0">
                  <div className={cn(
                    'text-xs font-mono px-2.5 py-1 rounded-lg border',
                    pastDeadline
                      ? 'bg-surface-300/20 text-surface-500 border-surface-400/30'
                      : 'bg-emerald/10 text-emerald border-emerald/30',
                  )}>
                    <Clock className="h-3 w-3 inline mr-1" />
                    {pastDeadline ? 'Submissions closed' : `Questions close in ${formatCountdown(currentSession.questions_due_at)}`}
                  </div>
                  <p className="text-[10px] text-surface-500 font-mono mt-1">
                    Session closes {formatDate(currentSession.closes_at)}
                  </p>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gold/20">
                <div className="flex items-center gap-1.5 text-xs text-surface-500">
                  <Users className="h-3.5 w-3.5" />
                  <span>{currentSession.question_count ?? allQuestions.length} questions submitted</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-surface-500">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald" />
                  <span>{currentSession.answered_count ?? allQuestions.filter((q) => q.status === 'answered').length} answered</span>
                </div>
              </div>
            </div>

            {/* Submit form / button */}
            <AnimatePresence mode="wait">
              {showForm ? (
                <SubmitForm
                  key="form"
                  sessionId={currentSession.id}
                  onSubmitted={handleSubmitted}
                  onCancel={() => setShowForm(false)}
                />
              ) : questionsData?.my_question_id ? (
                <motion.div
                  key="my-q-banner"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-for-500/5 border border-for-500/20 mb-6 text-sm"
                >
                  <CheckCircle2 className="h-4 w-4 text-for-400 flex-shrink-0" />
                  <span className="text-surface-500">
                    You&apos;ve submitted your question for this session. Upvote others to help them rise.
                  </span>
                </motion.div>
              ) : canSubmit ? (
                <motion.button
                  key="submit-btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setShowForm(true)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-dashed border-for-500/40 bg-for-500/5 hover:bg-for-500/10 hover:border-for-500/60 transition-all mb-6 group"
                >
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-for-500/10 border border-for-500/30 group-hover:bg-for-500/20 transition-all">
                    <Mic className="h-4 w-4 text-for-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-white">Ask the Prime Minister</p>
                    <p className="text-xs text-surface-500">One question per session — make it count</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-surface-500 ml-auto group-hover:translate-x-0.5 transition-transform" />
                </motion.button>
              ) : !isOpen ? (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300/40 mb-6 text-xs text-surface-500">
                  <Scale className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>This session is not currently accepting questions.</span>
                </div>
              ) : null}
            </AnimatePresence>

            {/* Questions list */}
            <div className="flex items-center gap-2 mb-4">
              <p className="text-sm font-semibold text-white flex-1">
                Questions
              </p>
              <button
                onClick={() => selectedSessionId && fetchQuestions(selectedSessionId)}
                className="text-surface-500 hover:text-white transition-colors"
                aria-label="Refresh questions"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-surface-200/60 rounded-lg p-1 mb-4">
              {(
                [
                  { id: 'top', label: 'Top voted' },
                  { id: 'new', label: 'Newest' },
                  { id: 'answered', label: 'Answered' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'flex-1 text-xs font-mono py-1.5 rounded-md transition-all',
                    tab === t.id
                      ? 'bg-surface-100 text-white shadow-sm'
                      : 'text-surface-500 hover:text-white',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {questionsLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            ) : displayQuestions.length === 0 ? (
              <EmptyState
                icon={<HelpCircle className="h-8 w-8 text-surface-500" />}
                title={tab === 'answered' ? 'No answered questions yet' : 'No questions yet'}
                description={
                  tab === 'answered'
                    ? 'The PM has not yet answered any questions in this session.'
                    : canSubmit
                    ? 'Be the first to ask the Prime Minister something important.'
                    : 'No questions have been submitted yet for this session.'
                }
              />
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {displayQuestions.map((q, i) => (
                    <QuestionCard
                      key={q.id}
                      q={q}
                      rank={i + 1}
                      hasVoted={
                        questionsData?.my_votes.includes(q.id) ?? false
                      }
                      isOwn={q.id === questionsData?.my_question_id}
                      sessionOpen={isOpen && !pastDeadline}
                      onVote={handleVote}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* Past Sessions */}
        {(sessions?.past?.length ?? 0) > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-4 w-4 text-gold" />
              <h2 className="text-sm font-semibold text-white">Past Sessions</h2>
            </div>
            <div className="space-y-3">
              {sessions!.past.map((s) => (
                <PastSessionCard key={s.id} s={s} />
              ))}
            </div>
          </section>
        )}

        {/* Parliament link */}
        <div className="mt-8 pt-6 border-t border-surface-300/40 flex items-center justify-between">
          <Link
            href="/parliament"
            className="flex items-center gap-2 text-xs text-surface-500 hover:text-white transition-colors font-mono"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Parliament
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/government" className="text-xs text-surface-500 hover:text-gold transition-colors font-mono">Government</Link>
            <span className="text-surface-600">·</span>
            <Link href="/confidence" className="text-xs text-surface-500 hover:text-against-400 transition-colors font-mono">No Confidence</Link>
            <span className="text-surface-600">·</span>
            <Link href="/budget" className="text-xs text-surface-500 hover:text-emerald transition-colors font-mono">Budget</Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
