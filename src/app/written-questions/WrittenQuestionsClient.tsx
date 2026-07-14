'use client'

/**
 * /written-questions — Written Parliamentary Questions
 *
 * Citizens submit formal written questions to civic department leads.
 * Debators and Elders can post official written answers.
 * All Q&A is publicly visible and part of the civic record.
 *
 * Distinct from:
 *   /oral-questions  — spoken session questions (rotating department, time-boxed)
 *   /questions       — informal Q&A on topics (civic minister questions)
 *   /ama             — casual ask-me-anything sessions
 *
 * Written questions are:
 *   • More formal and have a 14-day answer window
 *   • Addressed to specific departments (not individual users)
 *   • Upvotable so the most pressing questions surface first
 *   • Open to any citizen to submit; only Debators+ to answer
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileText,
  Gavel,
  Info,
  Loader2,
  MessageSquare,
  PenLine,
  RefreshCw,
  Send,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { WrittenQuestion, WrittenQuestionsResponse } from '@/app/api/written-questions/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const DEPARTMENTS = [
  { slug: 'all',            label: 'All Departments' },
  { slug: 'treasury',       label: 'Treasury' },
  { slug: 'health',         label: 'Health' },
  { slug: 'education',      label: 'Education' },
  { slug: 'home-affairs',   label: 'Home Affairs' },
  { slug: 'foreign-affairs',label: 'Foreign Affairs' },
  { slug: 'environment',    label: 'Environment' },
  { slug: 'science',        label: 'Science & Tech' },
  { slug: 'housing',        label: 'Housing' },
  { slug: 'transport',      label: 'Transport' },
  { slug: 'culture',        label: 'Culture' },
]

const DEPT_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  treasury:        { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/20' },
  health:          { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/20' },
  education:       { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/20' },
  'home-affairs':  { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/20' },
  'foreign-affairs':{ text: 'text-purple',     bg: 'bg-purple/10',      border: 'border-purple/20' },
  environment:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/20' },
  science:         { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/20' },
  housing:         { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/20' },
  transport:       { text: 'text-for-300',     bg: 'bg-for-400/10',     border: 'border-for-400/20' },
  culture:         { text: 'text-against-300', bg: 'bg-against-400/10', border: 'border-against-400/20' },
}

function deptColor(slug: string) {
  return DEPT_COLOR[slug] ?? { text: 'text-surface-400', bg: 'bg-surface-300/40', border: 'border-surface-400/30' }
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof FileText; color: string; bg: string }> = {
  open:     { label: 'Awaiting Answer', icon: Clock,        color: 'text-surface-400', bg: 'bg-surface-300/40' },
  answered: { label: 'Answered',        icon: Check,        color: 'text-emerald',     bg: 'bg-emerald/10' },
  declined: { label: 'Declined',        icon: X,            color: 'text-against-400', bg: 'bg-against-500/10' },
  expired:  { label: 'Expired',         icon: AlertCircle,  color: 'text-surface-500', bg: 'bg-surface-300/30' },
}

const SORT_OPTIONS = [
  { id: 'top',       label: 'Most Supported' },
  { id: 'new',       label: 'Most Recent' },
  { id: 'unanswered',label: 'Unanswered' },
  { id: 'urgent',    label: 'Urgent' },
] as const

type SortOption = typeof SORT_OPTIONS[number]['id']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
}

function deptLabel(slug: string): string {
  return DEPARTMENTS.find((d) => d.slug === slug)?.label ?? slug
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function QuestionCard({
  question,
  userId,
  hasUpvoted,
  onUpvote,
}: {
  question: WrittenQuestion
  userId: string | null
  hasUpvoted: boolean
  onUpvote: (id: string, direction: 'up' | 'down') => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [answering, setAnswering] = useState(false)
  const [answerText, setAnswerText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [localUpvotes, setLocalUpvotes] = useState(question.upvotes)
  const [localHasUpvoted, setLocalHasUpvoted] = useState(hasUpvoted)

  const dc = deptColor(question.department)
  const st = STATUS_CONFIG[question.status] ?? STATUS_CONFIG.open
  const StatusIcon = st.icon

  async function handleUpvote(e: React.MouseEvent) {
    e.stopPropagation()
    if (!userId) return
    const direction = localHasUpvoted ? 'down' : 'up'
    setLocalHasUpvoted(!localHasUpvoted)
    setLocalUpvotes((n) => n + (direction === 'up' ? 1 : -1))
    onUpvote(question.id, direction)
    try {
      await fetch(`/api/written-questions/${question.id}/upvote`, {
        method: direction === 'up' ? 'POST' : 'DELETE',
      })
    } catch {
      // revert on error
      setLocalHasUpvoted(localHasUpvoted)
      setLocalUpvotes((n) => n + (direction === 'up' ? -1 : 1))
    }
  }

  async function handleAnswer(e: React.FormEvent) {
    e.preventDefault()
    if (!answerText.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/written-questions/${question.id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer_text: answerText }),
      })
      if (res.ok) {
        setAnswering(false)
        setAnswerText('')
        // Refresh by reloading page
        window.location.reload()
      } else {
        const err = await res.json()
        alert(err.error ?? 'Failed to submit answer')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border bg-surface-100 overflow-hidden transition-colors',
        question.is_urgent ? 'border-against-500/40' : 'border-surface-300',
      )}
    >
      {/* Header row */}
      <div className="p-4">
        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {question.is_urgent && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-against-500/15 border border-against-500/30 text-against-400 text-[11px] font-mono font-bold">
              <Zap className="h-3 w-3" />
              URGENT
            </span>
          )}
          <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-mono font-semibold', dc.text, dc.bg, dc.border)}>
            <FileText className="h-3 w-3" />
            {deptLabel(question.department)}
          </span>
          <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold', st.color, st.bg)}>
            <StatusIcon className="h-3 w-3" />
            {st.label}
          </span>
          {question.status === 'open' && (
            <span className="text-[11px] text-surface-500 font-mono">
              {daysUntil(question.expires_at)}d remaining
            </span>
          )}
        </div>

        {/* Author and question */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {question.author ? (
              <Link href={`/profile/${question.author.username}`}>
                <Avatar
                  src={question.author.avatar_url}
                  fallback={question.author.display_name || question.author.username}
                  size="sm"
                />
              </Link>
            ) : (
              <div className="h-8 w-8 rounded-full bg-surface-300" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            {question.author && (
              <div className="flex items-center gap-1.5 mb-1">
                <Link
                  href={`/profile/${question.author.username}`}
                  className="text-xs font-semibold text-white hover:text-for-400 transition-colors"
                >
                  {question.author.display_name || question.author.username}
                </Link>
                <span className="text-[10px] text-surface-500">@{question.author.username}</span>
                <span className="text-[10px] text-surface-600">{timeAgo(question.created_at)}</span>
              </div>
            )}
            <p className="text-sm text-white/90 leading-relaxed">{question.question_text}</p>
            {question.context_text && (
              <p className="mt-2 text-xs text-surface-400 italic">{question.context_text}</p>
            )}
            {question.topic && (
              <Link
                href={`/topic/${question.topic.id}`}
                className="mt-2 inline-flex items-center gap-1 text-[11px] text-for-400 hover:text-for-300 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Re: {question.topic.statement.slice(0, 60)}{question.topic.statement.length > 60 ? '…' : ''}
              </Link>
            )}
          </div>
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-surface-300/50">
          <button
            onClick={handleUpvote}
            disabled={!userId}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-all',
              localHasUpvoted
                ? 'bg-for-600/20 border-for-600/40 text-for-400'
                : 'bg-surface-200 border-surface-400/50 text-surface-400 hover:text-for-400 hover:border-for-600/40',
              !userId && 'opacity-50 cursor-not-allowed',
            )}
          >
            <ChevronUp className="h-3.5 w-3.5" />
            {localUpvotes}
          </button>

          {question.answer && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border border-emerald/30 bg-emerald/10 text-emerald hover:bg-emerald/20 transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              View Answer
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}

          {question.status === 'open' && userId && !question.answer && (
            <button
              onClick={() => setAnswering((a) => !a)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border border-surface-400/50 bg-surface-200 text-surface-400 hover:text-white hover:border-surface-500 transition-colors"
            >
              <PenLine className="h-3.5 w-3.5" />
              Answer
            </button>
          )}
        </div>
      </div>

      {/* Official Answer */}
      <AnimatePresence>
        {(expanded || answering) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-surface-300/50"
          >
            {expanded && question.answer && (
              <div className="p-4 bg-emerald/5">
                <div className="flex items-start gap-3">
                  {question.answer.answerer && (
                    <Link href={`/profile/${question.answer.answerer.username}`} className="flex-shrink-0">
                      <Avatar
                        src={question.answer.answerer.avatar_url}
                        fallback={question.answer.answerer.display_name || question.answer.answerer.username}
                        size="sm"
                      />
                    </Link>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      {question.answer.answerer && (
                        <Link
                          href={`/profile/${question.answer.answerer.username}`}
                          className="text-xs font-semibold text-emerald hover:text-emerald/80"
                        >
                          {question.answer.answerer.display_name || question.answer.answerer.username}
                        </Link>
                      )}
                      <span className="px-1.5 py-0.5 rounded bg-emerald/20 text-emerald text-[10px] font-mono font-bold">
                        OFFICIAL ANSWER
                      </span>
                      <span className="text-[10px] text-surface-500">{timeAgo(question.answer.created_at)}</span>
                    </div>
                    <p className="text-sm text-white/90 leading-relaxed">{question.answer.answer_text}</p>
                  </div>
                </div>
              </div>
            )}

            {answering && !question.answer && (
              <form onSubmit={handleAnswer} className="p-4 bg-surface-200/50">
                <p className="text-xs text-surface-400 mb-3">
                  As a Debator or Elder, you can provide an official written answer. Your answer will be publicly visible.
                </p>
                <textarea
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Write your official answer... (20–2000 characters)"
                  rows={4}
                  maxLength={2000}
                  className={cn(
                    'w-full px-3 py-2 rounded-xl text-sm text-white bg-surface-100 border border-surface-400/50',
                    'focus:outline-none focus:border-emerald/50 focus:ring-1 focus:ring-emerald/30',
                    'placeholder:text-surface-500 resize-none',
                  )}
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-surface-500 font-mono">{answerText.length}/2000</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setAnswering(false); setAnswerText('') }}
                      className="px-3 py-1.5 rounded-lg text-xs border border-surface-400/50 text-surface-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={answerText.trim().length < 20 || submitting}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold',
                        'bg-emerald text-white border border-emerald/50',
                        'hover:bg-emerald/90 transition-colors',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                      )}
                    >
                      {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Submit Answer
                    </button>
                  </div>
                </div>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Submit Question Modal ────────────────────────────────────────────────────

function SubmitModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: () => void
}) {
  const [department, setDepartment] = useState('')
  const [questionText, setQuestionText] = useState('')
  const [contextText, setContextText] = useState('')
  const [isUrgent, setIsUrgent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => textRef.current?.focus(), 100)
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!department) { setError('Please select a department.'); return }
    if (questionText.trim().length < 20) { setError('Question must be at least 20 characters.'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/written-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department, question_text: questionText, context_text: contextText, is_urgent: isUrgent }),
      })
      if (res.ok) {
        setDepartment('')
        setQuestionText('')
        setContextText('')
        setIsUrgent(false)
        onSubmit()
        onClose()
      } else {
        const err = await res.json()
        setError(err.error ?? 'Failed to submit question')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-lg mx-auto"
          >
            <div className="rounded-2xl bg-surface-100 border border-surface-300 shadow-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-white">Submit Written Question</h2>
                  <p className="text-xs text-surface-400 mt-0.5">Formally address a department — on the public record</p>
                </div>
                <button onClick={onClose} className="p-1 rounded-lg text-surface-400 hover:text-white hover:bg-surface-200 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Department */}
                <div>
                  <label className="block text-xs font-semibold text-surface-300 mb-1.5">Department *</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm text-white bg-surface-200 border border-surface-400/50 focus:outline-none focus:border-for-500/50 focus:ring-1 focus:ring-for-500/20"
                  >
                    <option value="">Select a department…</option>
                    {DEPARTMENTS.filter((d) => d.slug !== 'all').map((d) => (
                      <option key={d.slug} value={d.slug}>{d.label}</option>
                    ))}
                  </select>
                </div>

                {/* Question */}
                <div>
                  <label className="block text-xs font-semibold text-surface-300 mb-1.5">Your Question * <span className="font-normal text-surface-500">(20–600 chars)</span></label>
                  <textarea
                    ref={textRef}
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    placeholder="What formal question do you wish to put to this department?"
                    rows={4}
                    maxLength={600}
                    className={cn(
                      'w-full px-3 py-2 rounded-xl text-sm text-white bg-surface-200 border border-surface-400/50',
                      'focus:outline-none focus:border-for-500/50 focus:ring-1 focus:ring-for-500/20',
                      'placeholder:text-surface-500 resize-none',
                    )}
                  />
                  <div className="flex justify-end mt-1">
                    <span className={cn('text-[11px] font-mono', questionText.length > 550 ? 'text-against-400' : 'text-surface-500')}>
                      {questionText.length}/600
                    </span>
                  </div>
                </div>

                {/* Context (optional) */}
                <div>
                  <label className="block text-xs font-semibold text-surface-300 mb-1.5">Context <span className="font-normal text-surface-500">(optional)</span></label>
                  <textarea
                    value={contextText}
                    onChange={(e) => setContextText(e.target.value)}
                    placeholder="Background or motivation for this question…"
                    rows={2}
                    maxLength={300}
                    className={cn(
                      'w-full px-3 py-2 rounded-xl text-sm text-white bg-surface-200 border border-surface-400/50',
                      'focus:outline-none focus:border-for-500/50 focus:ring-1 focus:ring-for-500/20',
                      'placeholder:text-surface-500 resize-none',
                    )}
                  />
                </div>

                {/* Urgent toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setIsUrgent((u) => !u)}
                    className={cn(
                      'h-5 w-9 rounded-full transition-colors border',
                      isUrgent ? 'bg-against-500 border-against-500' : 'bg-surface-300 border-surface-400',
                    )}
                  >
                    <div className={cn('h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5', isUrgent ? 'translate-x-4' : 'translate-x-0.5')} />
                  </div>
                  <span className="text-xs text-surface-300">Mark as Urgent — requires immediate response</span>
                </label>

                {error && (
                  <p className="text-xs text-against-400 bg-against-500/10 border border-against-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2 rounded-xl text-sm border border-surface-400/50 text-surface-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !department || questionText.trim().length < 20}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold',
                      'bg-for-600 text-white border border-for-500/50 hover:bg-for-500 transition-colors',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Submit Question
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function WrittenQuestionsClient() {
  const [data, setData] = useState<WrittenQuestionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dept, setDept] = useState<string>('all')
  const [sort, setSort] = useState<SortOption>('top')
  const [statusFilter, setStatusFilter] = useState<string>('open')
  const [modalOpen, setModalOpen] = useState(false)
  const [upvoteMap, setUpvoteMap] = useState<Record<string, boolean>>({})

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    else setLoading(true)
    try {
      const params = new URLSearchParams({ sort, status: statusFilter === 'unanswered' ? 'unanswered' : statusFilter })
      if (dept !== 'all') params.set('department', dept)
      const res = await fetch(`/api/written-questions?${params}`, { cache: 'no-store' })
      if (!res.ok) return
      const json = (await res.json()) as WrittenQuestionsResponse
      setData(json)
      const map: Record<string, boolean> = {}
      for (const id of json.userUpvotes) map[id] = true
      setUpvoteMap(map)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [dept, sort, statusFilter])

  useEffect(() => { fetchData() }, [fetchData])

  function handleUpvote(id: string, direction: 'up' | 'down') {
    setUpvoteMap((m) => ({ ...m, [id]: direction === 'up' }))
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/parliament" className="text-surface-500 hover:text-white transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <h1 className="text-xl font-bold text-white">Written Questions</h1>
            </div>
            <p className="text-sm text-surface-400 max-w-md">
              Formally question civic department leads. All answers are public record. Elders and Debators must respond within 14 days.
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            disabled={!data?.userId}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold',
              'bg-for-600 text-white border border-for-500/50 hover:bg-for-500 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            <PenLine className="h-4 w-4" />
            <span className="hidden sm:inline">Submit</span>
          </button>
        </div>

        {/* Info box */}
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-surface-200/60 border border-surface-300/60 mb-5">
          <Info className="h-4 w-4 text-surface-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-surface-400 leading-relaxed">
            Written Questions are part of the official civic record. Questions are addressed to departments, not individuals.
            Debators and Elders may submit official written answers. Upvote questions you want answered first.
          </p>
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap gap-2 mb-4">
          {/* Status filter */}
          {(['open', 'answered', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-all',
                statusFilter === s
                  ? 'bg-for-600/30 border-for-600/50 text-for-400'
                  : 'bg-surface-200 border-surface-400/40 text-surface-400 hover:text-white',
              )}
            >
              {s === 'open' ? 'Awaiting Answer' : s === 'answered' ? 'Answered' : 'All'}
            </button>
          ))}
          <div className="h-6 border-l border-surface-400/30 self-center mx-1" />
          {/* Sort */}
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.id}
              onClick={() => setSort(o.id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-all',
                sort === o.id
                  ? 'bg-surface-200 border-surface-400 text-white'
                  : 'bg-surface-200/50 border-surface-400/30 text-surface-500 hover:text-white',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Department filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
          {DEPARTMENTS.map((d) => {
            const dc = d.slug !== 'all' ? deptColor(d.slug) : null
            return (
              <button
                key={d.slug}
                onClick={() => setDept(d.slug)}
                className={cn(
                  'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-all',
                  dept === d.slug
                    ? dc
                      ? cn('border-opacity-60', dc.text, dc.bg, dc.border)
                      : 'bg-for-600/20 border-for-600/40 text-for-400'
                    : 'bg-surface-200/50 border-surface-400/30 text-surface-500 hover:text-white',
                )}
              >
                {d.label}
              </button>
            )
          })}
        </div>

        {/* Refresh button */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-surface-500 font-mono">
            {data ? `${data.total} question${data.total !== 1 ? 's' : ''}` : ''}
          </p>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-1 text-xs text-surface-500 hover:text-white transition-colors"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Questions list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <div className="flex items-start gap-3">
                  <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : !data?.questions.length ? (
          <EmptyState
            icon={MessageSquare}
            title="No questions yet"
            description={
              dept !== 'all'
                ? `No ${statusFilter === 'all' ? '' : statusFilter + ' '}questions for this department. Be the first to ask.`
                : `No ${statusFilter === 'all' ? '' : statusFilter + ' '}written questions yet. Submit the first one.`
            }
            action={data?.userId ? { label: 'Submit a Question', onClick: () => setModalOpen(true) } : undefined}
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {data.questions.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  userId={data.userId}
                  hasUpvoted={upvoteMap[q.id] ?? false}
                  onUpvote={handleUpvote}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Parliament links */}
        <div className="mt-8 pt-6 border-t border-surface-300/50">
          <p className="text-xs text-surface-500 mb-3 font-mono">Related Parliamentary Proceedings</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: '/oral-questions', label: 'Oral Questions', icon: Gavel },
              { href: '/parliament',     label: 'Parliament Hub', icon: FileText },
              { href: '/order-paper',    label: 'Order Paper',    icon: FileText },
              { href: '/hansard',        label: 'Hansard',        icon: FileText },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-100 border border-surface-300 text-xs text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </main>

      <BottomNav />

      <SubmitModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={() => fetchData(true)}
      />
    </div>
  )
}
