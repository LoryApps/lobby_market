'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  ExternalLink,
  Flame,
  Loader2,
  MessageSquare,
  Mic,
  Plus,
  RefreshCw,
  Send,
  Shield,
  Sparkles,
  ThumbsUp,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { MinisterQuestion, QuestionsResponse } from '@/app/api/civic-questions/route'
import type { CabinetSeat, ShadowCabinetResponse } from '@/app/api/shadow-cabinet/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Education', 'Environment',
]

const CAT_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Ethics:      { text: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Health:      { text: 'text-against-300', bg: 'bg-against-400/10', border: 'border-against-400/30' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Philosophy:  { text: 'text-for-300',     bg: 'bg-for-300/10',     border: 'border-for-300/30' },
}

function catStyle(cat: string) {
  return CAT_STYLE[cat] ?? { text: 'text-surface-500', bg: 'bg-surface-300/20', border: 'border-surface-400/30' }
}

function formatRelativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatExpiry(ts: string): string {
  const diff = new Date(ts).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (h < 1) return 'Expires soon'
  if (h < 24) return `${h}h to respond`
  return `${d}d to respond`
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, expiresAt }: { status: string; expiresAt: string }) {
  if (status === 'answered') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono bg-emerald/10 text-emerald border border-emerald/30">
        <CheckCircle2 className="h-3 w-3" />Answered
      </span>
    )
  }
  if (status === 'expired' || new Date(expiresAt) < new Date()) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono bg-surface-300/30 text-surface-500 border border-surface-400/30">
        <Clock className="h-3 w-3" />Expired
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono bg-for-500/10 text-for-300 border border-for-500/30">
      <Zap className="h-3 w-3 animate-pulse" />Open
    </span>
  )
}

// ─── Question card ────────────────────────────────────────────────────────────

interface QuestionCardProps {
  question: MinisterQuestion
  currentUserId: string | null
  onUpvoteQuestion: (id: string) => void
  onUpvoteAnswer: (id: string) => void
  onAnswerSubmit: (id: string, text: string) => void
  expanded: boolean
  onToggleExpand: () => void
}

function QuestionCard({
  question,
  currentUserId,
  onUpvoteQuestion,
  onUpvoteAnswer,
  onAnswerSubmit,
  expanded,
  onToggleExpand,
}: QuestionCardProps) {
  const [answerText, setAnswerText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isMinister = currentUserId === question.minister.id
  const cat = catStyle(question.category)

  async function handleAnswer() {
    if (!answerText.trim() || submitting) return
    setSubmitting(true)
    await onAnswerSubmit(question.id, answerText.trim())
    setSubmitting(false)
    setAnswerText('')
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-100 border border-surface-300 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start gap-3">
          {/* Upvote */}
          <button
            onClick={() => onUpvoteQuestion(question.id)}
            disabled={!currentUserId}
            className={cn(
              'flex flex-col items-center gap-0.5 min-w-[40px] rounded-xl py-2 px-1.5 transition-colors',
              question.user_upvoted
                ? 'bg-for-500/15 text-for-300 border border-for-500/40'
                : 'bg-surface-200/60 text-surface-500 border border-surface-300/50 hover:bg-for-500/10 hover:text-for-400',
            )}
            aria-label={question.user_upvoted ? 'Remove upvote' : 'Upvote question'}
          >
            <ChevronUp className="h-4 w-4" />
            <span className="text-xs font-mono font-bold">{question.upvote_count}</span>
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={cn('text-xs font-mono font-semibold px-2 py-0.5 rounded-full border', cat.text, cat.bg, cat.border)}>
                {question.category}
              </span>
              <StatusBadge status={question.status} expiresAt={question.expires_at} />
              {question.status === 'open' && (
                <span className="text-xs font-mono text-surface-500 ml-auto">
                  {formatExpiry(question.expires_at)}
                </span>
              )}
            </div>

            <p className="text-sm font-medium text-white leading-snug mb-3">
              {question.question_text}
            </p>

            {question.context_text && (
              <p className="text-xs text-surface-500 mb-3 italic leading-snug">
                &ldquo;{question.context_text}&rdquo;
              </p>
            )}

            {question.topic_id && question.topic_statement && (
              <Link
                href={`/topic/${question.topic_id}`}
                className="inline-flex items-center gap-1 text-xs text-for-400 hover:text-for-300 mb-3"
              >
                <ExternalLink className="h-3 w-3" />
                <span className="truncate max-w-[200px]">{question.topic_statement}</span>
              </Link>
            )}

            {/* Participants */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Questioner */}
              <div className="flex items-center gap-1.5">
                <Avatar
                  src={question.questioner.avatar_url}
                  username={question.questioner.username}
                  size="xs"
                />
                <Link
                  href={`/profile/${question.questioner.username}`}
                  className="text-xs text-surface-500 hover:text-white transition-colors"
                >
                  {question.questioner.display_name ?? question.questioner.username}
                </Link>
                <span className="text-xs text-surface-600">→</span>
              </div>

              {/* Minister */}
              <div className="flex items-center gap-1.5">
                <Shield className="h-3 w-3 text-gold flex-shrink-0" aria-hidden="true" />
                <Avatar
                  src={question.minister.avatar_url}
                  username={question.minister.username}
                  size="xs"
                />
                <Link
                  href={`/profile/${question.minister.username}`}
                  className="text-xs text-gold hover:text-amber-300 font-medium transition-colors"
                >
                  {question.minister.display_name ?? question.minister.username}
                </Link>
              </div>

              <span className="text-xs text-surface-600 ml-auto">
                {formatRelativeTime(question.created_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Answer section */}
      {question.answer && (
        <div className="border-t border-surface-300 bg-surface-200/30">
          <button
            onClick={onToggleExpand}
            className="w-full flex items-center gap-2 px-5 py-3 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald flex-shrink-0" />
            <span className="flex-1 text-left text-xs font-mono">Minister&apos;s response</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-4">
                  <div className="flex items-start gap-3">
                    <Avatar
                      src={question.answer.minister.avatar_url}
                      username={question.answer.minister.username}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Link
                          href={`/profile/${question.answer.minister.username}`}
                          className="text-xs font-mono font-semibold text-gold hover:text-amber-300"
                        >
                          {question.answer.minister.display_name ?? question.answer.minister.username}
                        </Link>
                        <span className="text-xs text-surface-600">·</span>
                        <span className="text-xs text-surface-500">{formatRelativeTime(question.answer.created_at)}</span>
                      </div>
                      <p className="text-sm text-surface-700 leading-relaxed">
                        {question.answer.answer_text}
                      </p>
                      {question.answer.topic_links.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {question.answer.topic_links.map((tid) => (
                            <Link
                              key={tid}
                              href={`/topic/${tid}`}
                              className="text-xs text-for-400 hover:text-for-300 flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Topic
                            </Link>
                          ))}
                        </div>
                      )}

                      {/* Answer upvote */}
                      <button
                        onClick={() => onUpvoteAnswer(question.id)}
                        disabled={!currentUserId || currentUserId === question.minister.id}
                        className={cn(
                          'mt-3 flex items-center gap-1.5 text-xs font-mono rounded-lg px-3 py-1.5 transition-colors border',
                          question.answer.user_upvoted
                            ? 'bg-emerald/10 text-emerald border-emerald/30'
                            : 'bg-surface-200/60 text-surface-500 border-surface-300/50 hover:bg-emerald/10 hover:text-emerald',
                        )}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                        {question.answer.upvote_count} Helpful
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Minister answer form */}
      {isMinister && question.status === 'open' && !question.answer && (
        <div className="border-t border-surface-300 bg-surface-200/30 p-4">
          <p className="text-xs font-mono text-gold mb-2 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            You are the addressed minister — respond below
          </p>
          <textarea
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            placeholder="Type your ministerial response (10–1000 characters)…"
            rows={3}
            maxLength={1000}
            className="w-full bg-surface-100 border border-surface-300 rounded-xl px-3 py-2 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-gold/50 resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs font-mono text-surface-500">{answerText.length}/1000</span>
            <Button
              size="sm"
              onClick={handleAnswer}
              disabled={answerText.trim().length < 10 || submitting}
              className="flex items-center gap-1.5"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Submit Response
            </Button>
          </div>
        </div>
      )}
    </motion.article>
  )
}

// ─── Ask question modal ────────────────────────────────────────────────────────

interface AskModalProps {
  ministers: CabinetSeat[]
  onClose: () => void
  onSubmit: (data: { minister_id: string; category: string; question_text: string; context_text?: string }) => Promise<void>
}

function AskModal({ ministers, onClose, onSubmit }: AskModalProps) {
  const [selectedMinister, setSelectedMinister] = useState<{ id: string; username: string; display_name: string | null; category: string } | null>(null)
  const [questionText, setQuestionText] = useState('')
  const [contextText, setContextText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const incumbents = ministers
    .map((s) => s.incumbent ? { ...s.incumbent, category: s.category } : null)
    .filter(Boolean) as Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null; category: string }>

  async function handleSubmit() {
    if (!selectedMinister || !questionText.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        minister_id: selectedMinister.id,
        category: selectedMinister.category,
        question_text: questionText.trim(),
        context_text: contextText.trim() || undefined,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit')
      setSubmitting(false)
    }
  }

  const charCount = questionText.length
  const charOk = charCount >= 20 && charCount <= 500

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 32 }}
        className="w-full max-w-lg bg-surface-100 border border-surface-300 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-300">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gold/10 flex items-center justify-center border border-gold/30">
              <MessageSquare className="h-4 w-4 text-gold" />
            </div>
            <div>
              <h2 className="font-mono font-semibold text-white text-sm">Submit a Question</h2>
              <p className="text-xs text-surface-500 font-mono">Hold your minister accountable</p>
            </div>
          </div>
          <button onClick={onClose} className="text-surface-500 hover:text-white transition-colors p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Select minister */}
          <div>
            <label className="block text-xs font-mono text-surface-500 mb-2 uppercase tracking-wider">
              Select Minister
            </label>
            {incumbents.length === 0 ? (
              <p className="text-xs text-surface-500 italic">No ministers currently in cabinet. Check back soon.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                {incumbents.map((m) => {
                  const cs = catStyle(m.category)
                  const isSelected = selectedMinister?.id === m.id
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMinister({ id: m.id, username: m.username, display_name: m.display_name, category: m.category })}
                      className={cn(
                        'flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all',
                        isSelected
                          ? 'bg-gold/10 border-gold/50 shadow-sm shadow-gold/20'
                          : 'bg-surface-200/50 border-surface-300/50 hover:border-surface-400/50',
                      )}
                    >
                      <Avatar src={m.avatar_url} username={m.username} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-mono font-medium text-white truncate">
                          {m.display_name ?? m.username}
                        </p>
                        <p className={cn('text-[10px] font-mono', cs.text)}>{m.category}</p>
                      </div>
                      {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-gold ml-auto flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Question text */}
          <div>
            <label className="block text-xs font-mono text-surface-500 mb-2 uppercase tracking-wider">
              Your Question <span className="text-against-400">*</span>
            </label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="What do you want to ask the minister? Be specific and civic-minded."
              rows={3}
              maxLength={500}
              className="w-full bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-for-500/50 resize-none"
            />
            <div className="flex justify-between mt-1">
              <p className="text-xs text-surface-600">20 characters minimum</p>
              <p className={cn('text-xs font-mono', charOk ? 'text-surface-500' : 'text-against-400')}>
                {charCount}/500
              </p>
            </div>
          </div>

          {/* Optional context */}
          <div>
            <label className="block text-xs font-mono text-surface-500 mb-2 uppercase tracking-wider">
              Context <span className="text-surface-600">(optional)</span>
            </label>
            <input
              type="text"
              value={contextText}
              onChange={(e) => setContextText(e.target.value)}
              placeholder="Brief context for why this matters…"
              maxLength={200}
              className="w-full bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-for-500/50"
            />
          </div>

          {error && (
            <p className="text-xs text-against-400 bg-against-500/10 border border-against-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={!selectedMinister || !charOk || submitting}
            className="w-full flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Submit Question
          </Button>

          <p className="text-xs text-surface-600 text-center font-mono">
            Limit: 5 questions per 24 hours. Questions expire after 7 days if unanswered.
          </p>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type SortMode = 'hot' | 'new' | 'answered'
type FilterStatus = 'all' | 'open' | 'answered'

export function CivicQuestionsClient() {
  const [questions, setQuestions] = useState<MinisterQuestion[]>([])
  const [ministers, setMinisters] = useState<CabinetSeat[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [sort, setSort] = useState<SortMode>('hot')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [filterMinister, _setFilterMinister] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const LIMIT = 15

  // Auth
  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      const sb = createClient()
      sb.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null))
    })
  }, [])

  // Fetch ministers (for the modal)
  useEffect(() => {
    fetch('/api/shadow-cabinet')
      .then((r) => r.json())
      .then((data: ShadowCabinetResponse) => setMinisters(data.seats ?? []))
      .catch(() => {})
  }, [])

  const fetchQuestions = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true)
      setOffset(0)
    } else {
      setLoadingMore(true)
    }

    const currentOffset = reset ? 0 : offset
    const params = new URLSearchParams({
      sort,
      limit: String(LIMIT),
      offset: String(currentOffset),
    })
    if (filterCategory) params.set('category', filterCategory)
    if (filterMinister) params.set('minister', filterMinister)
    if (filterStatus !== 'all') params.set('status', filterStatus)

    try {
      const res = await fetch(`/api/civic-questions?${params}`)
      const data: QuestionsResponse = await res.json()

      if (reset) {
        setQuestions(data.questions)
      } else {
        setQuestions((prev) => [...prev, ...data.questions])
      }
      setTotal(data.total)
      if (!reset) setOffset(currentOffset + LIMIT)
    } catch {
      // Swallow
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [sort, filterCategory, filterMinister, filterStatus, offset])

  useEffect(() => {
    fetchQuestions(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, filterCategory, filterMinister, filterStatus])

  async function handleUpvoteQuestion(id: string) {
    if (!currentUserId) return
    const res = await fetch(`/api/civic-questions/${id}/upvote`, { method: 'POST' })
    const { upvoted } = await res.json() as { upvoted: boolean }

    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id
          ? { ...q, upvote_count: q.upvote_count + (upvoted ? 1 : -1), user_upvoted: upvoted }
          : q
      )
    )
  }

  async function handleUpvoteAnswer(questionId: string) {
    if (!currentUserId) return
    const res = await fetch(`/api/civic-questions/${questionId}/answer-upvote`, { method: 'POST' })
    const { upvoted } = await res.json() as { upvoted: boolean }

    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId && q.answer
          ? {
              ...q,
              answer: {
                ...q.answer,
                upvote_count: q.answer.upvote_count + (upvoted ? 1 : -1),
                user_upvoted: upvoted,
              },
            }
          : q
      )
    )
  }

  async function handleAnswerSubmit(questionId: string, answerText: string) {
    const res = await fetch(`/api/civic-questions/${questionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer_text: answerText }),
    })
    if (!res.ok) {
      const { error } = await res.json() as { error: string }
      throw new Error(error)
    }
    // Refresh this question
    fetchQuestions(true)
  }

  async function handleAskSubmit(data: {
    minister_id: string
    category: string
    question_text: string
    context_text?: string
  }) {
    const res = await fetch('/api/civic-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const body = await res.json() as { error: string }
      throw new Error(body.error ?? 'Failed to submit question')
    }
    fetchQuestions(true)
  }

  const hasMore = questions.length < total

  const answeredCount = questions.filter((q) => q.status === 'answered').length
  const openCount = questions.filter((q) => q.status === 'open').length

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <Link href="/shadow-cabinet" className="text-surface-500 hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center">
                <MessageSquare className="h-4.5 w-4.5 text-gold" />
              </div>
              <div>
                <h1 className="font-mono text-xl font-bold text-white">Questions Time</h1>
                <p className="text-xs font-mono text-surface-500">Hold your ministers accountable</p>
              </div>
            </div>
            {currentUserId && (
              <Button
                size="sm"
                onClick={() => setModalOpen(true)}
                className="ml-auto flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Ask Question
              </Button>
            )}
          </div>

          {/* Info strip */}
          <div className="mt-3 flex items-center gap-4 text-xs font-mono text-surface-500 bg-surface-100 border border-surface-300 rounded-xl px-4 py-2.5">
            <span className="flex items-center gap-1.5">
              <Mic className="h-3.5 w-3.5 text-gold" />Westminster-style Q&amp;A
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-for-400" />7-day response window
            </span>
            <span className="flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-against-400" />5 questions / day
            </span>
            <Link
              href="/civic-questions/hall-of-fame"
              className="ml-auto flex items-center gap-1.5 text-gold hover:text-gold/80 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Hall of Fame
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Total Questions', value: total, icon: MessageSquare, color: 'text-for-400' },
            { label: 'Awaiting Answer', value: openCount, icon: Clock, color: 'text-gold' },
            { label: 'Answered', value: answeredCount, icon: CheckCircle2, color: 'text-emerald' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-surface-100 border border-surface-300 rounded-xl p-3.5 text-center">
              <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} />
              <p className={cn('text-xl font-mono font-bold', color)}>{value}</p>
              <p className="text-xs font-mono text-surface-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {/* Sort */}
          <div className="flex items-center gap-1 bg-surface-100 border border-surface-300 rounded-xl p-1">
            {(['hot', 'new', 'answered'] as SortMode[]).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-mono capitalize transition-colors',
                  sort === s
                    ? 'bg-surface-300 text-white'
                    : 'text-surface-500 hover:text-white',
                )}
              >
                {s === 'hot' ? '🔥 Hot' : s === 'new' ? '✦ New' : '✓ Answered'}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="bg-surface-100 border border-surface-300 rounded-xl px-3 py-1.5 text-xs font-mono text-surface-500 focus:outline-none focus:border-for-500/50"
          >
            <option value="all">All status</option>
            <option value="open">Open</option>
            <option value="answered">Answered</option>
          </select>

          {/* Category filter */}
          <select
            value={filterCategory ?? ''}
            onChange={(e) => setFilterCategory(e.target.value || null)}
            className="bg-surface-100 border border-surface-300 rounded-xl px-3 py-1.5 text-xs font-mono text-surface-500 focus:outline-none focus:border-for-500/50"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <button
            onClick={() => fetchQuestions(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-100 border border-surface-300 rounded-xl text-xs font-mono text-surface-500 hover:text-white transition-colors ml-auto"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {/* Questions list */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface-100 border border-surface-300 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                    <div className="flex gap-3">
                      <Skeleton className="h-6 w-24 rounded-full" />
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : questions.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-8 w-8 text-surface-500" />}
            title="No questions yet"
            description={
              filterCategory || filterStatus !== 'all'
                ? 'No questions match your current filters.'
                : 'Be the first to question a Shadow Cabinet minister. Hold democracy accountable.'
            }
            action={
              currentUserId ? (
                <Button onClick={() => setModalOpen(true)} size="sm" className="flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Ask the First Question
                </Button>
              ) : (
                <Link href="/login">
                  <Button size="sm">Sign in to ask questions</Button>
                </Link>
              )
            }
          />
        ) : (
          <div className="space-y-4">
            {questions.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                currentUserId={currentUserId}
                onUpvoteQuestion={handleUpvoteQuestion}
                onUpvoteAnswer={handleUpvoteAnswer}
                onAnswerSubmit={handleAnswerSubmit}
                expanded={expandedId === q.id}
                onToggleExpand={() => setExpandedId(expandedId === q.id ? null : q.id)}
              />
            ))}

            {hasMore && (
              <button
                onClick={() => fetchQuestions(false)}
                disabled={loadingMore}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-mono text-surface-500 hover:text-white transition-colors"
              >
                {loadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Load more ({total - questions.length} remaining)
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Shadow Cabinet CTA */}
        <div className="mt-8 bg-surface-100 border border-gold/20 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <Shield className="h-5 w-5 text-gold" />
            <h3 className="font-mono font-semibold text-white text-sm">Shadow Cabinet</h3>
          </div>
          <p className="text-xs text-surface-500 font-mono mb-3">
            Questions Time is linked to the Shadow Cabinet. Ministers are the top-ranked citizens per civic category.
          </p>
          <div className="flex gap-2">
            <Link href="/shadow-cabinet">
              <Button variant="outline" size="sm" className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                View Cabinet
              </Button>
            </Link>
            <Link href="/delegate">
              <Button variant="outline" size="sm" className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Delegation
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <BottomNav />

      {/* Ask question modal */}
      <AnimatePresence>
        {modalOpen && (
          <AskModal
            ministers={ministers}
            onClose={() => setModalOpen(false)}
            onSubmit={handleAskSubmit}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
