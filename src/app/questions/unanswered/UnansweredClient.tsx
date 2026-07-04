'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Filter,
  HelpCircle,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  ThumbsUp,
  Zap,
  Flame,
  Clock,
  Star,
  Inbox,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import { createClient } from '@/lib/supabase/client'
import type { HubQuestion, HubQuestionsResponse } from '@/app/api/questions/route'
import type { TopicAnswer } from '@/app/api/topics/[id]/questions/[qid]/answers/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
  'Politics',
  'Economics',
  'Technology',
  'Ethics',
  'Philosophy',
  'Science',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

const SORT_OPTS = [
  { id: 'top',  label: 'Top',    icon: Star  },
  { id: 'hot',  label: 'Hot',    icon: Flame },
  { id: 'new',  label: 'New',    icon: Clock },
] as const

type SortId = (typeof SORT_OPTS)[number]['id']

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

const STATUS_COLOR: Record<string, string> = {
  proposed: 'text-surface-500 border-surface-500/40 bg-surface-500/10',
  active:   'text-for-400 border-for-500/40 bg-for-500/10',
  voting:   'text-purple border-purple/40 bg-purple/10',
  law:      'text-emerald border-emerald/40 bg-emerald/10',
  failed:   'text-against-400 border-against-500/40 bg-against-500/10',
}

// ─── Inline Answer Sheet ──────────────────────────────────────────────────────

interface AnswerSheetProps {
  question: HubQuestion
  currentUserId: string | null
  onAnswerPosted: () => void
}

function AnswerSheet({ question, currentUserId, onAnswerPosted }: AnswerSheetProps) {
  const [answers, setAnswers]       = useState<TopicAnswer[]>([])
  const [loading, setLoading]       = useState(true)
  const [text, setText]             = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [votingIds, setVotingIds]   = useState<Set<string>>(new Set())
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let mounted = true
    fetch(`/api/topics/${question.topic_id}/questions/${question.id}/answers`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (mounted && d?.answers) setAnswers(d.answers as TopicAnswer[]) })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [question.id, question.topic_id])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (trimmed.length < 10 || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/topics/${question.topic_id}/questions/${question.id}/answers`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: trimmed }),
        }
      )
      if (res.ok) {
        const data = await res.json()
        if (data.answer) {
          setAnswers((prev) => [...prev, data.answer as TopicAnswer])
          setText('')
          onAnswerPosted()
        }
      }
    } catch {
      // best-effort
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAnswerVote(ans: TopicAnswer) {
    if (votingIds.has(ans.id) || !currentUserId) return
    setVotingIds((s) => new Set(s).add(ans.id))
    try {
      const res = await fetch(
        `/api/topics/${question.topic_id}/questions/${question.id}/answers/${ans.id}/vote`,
        { method: ans.user_voted ? 'DELETE' : 'POST' }
      )
      if (res.ok) {
        const data = await res.json()
        setAnswers((prev) =>
          prev.map((a) =>
            a.id === ans.id ? { ...a, user_voted: data.voted, upvotes: data.upvotes } : a
          )
        )
      }
    } catch {
      // best-effort
    } finally {
      setVotingIds((s) => { const n = new Set(s); n.delete(ans.id); return n })
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-surface-300/50">
      {/* Existing answers */}
      {loading ? (
        <div className="space-y-2 mb-3">
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      ) : answers.length > 0 ? (
        <div className="space-y-2 mb-3">
          {answers.map((ans) => (
            <div
              key={ans.id}
              className={cn(
                'p-3 rounded-xl text-sm',
                ans.is_accepted
                  ? 'bg-emerald/5 border border-emerald/25'
                  : 'bg-surface-300/30 border border-surface-300/50'
              )}
            >
              <div className="flex gap-2">
                {ans.is_accepted && (
                  <div className="flex-shrink-0 mt-0.5 flex items-center justify-center h-4 w-4 rounded-full bg-emerald/20 border border-emerald/40">
                    <Check className="h-2.5 w-2.5 text-emerald" />
                  </div>
                )}
                <p className="flex-1 text-surface-100 leading-relaxed">{ans.content}</p>
              </div>
              <div className="flex items-center justify-between gap-2 mt-2">
                {ans.author ? (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Avatar
                      src={ans.author.avatar_url}
                      fallback={ans.author.display_name || ans.author.username}
                      size="xs"
                    />
                    <Link
                      href={`/profile/${ans.author.username}`}
                      className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors truncate"
                    >
                      {ans.author.display_name || ans.author.username}
                    </Link>
                    <span className="text-[10px] text-surface-600 font-mono flex-shrink-0">
                      · {relativeTime(ans.created_at)}
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] font-mono text-surface-600">
                    {relativeTime(ans.created_at)}
                  </span>
                )}
                <button
                  onClick={() => handleAnswerVote(ans)}
                  disabled={votingIds.has(ans.id) || !currentUserId || ans.author_id === currentUserId}
                  aria-label={ans.user_voted ? 'Remove upvote' : 'Upvote answer'}
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-mono border transition-all flex-shrink-0',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                    ans.user_voted
                      ? 'bg-for-500/20 border-for-500/40 text-for-400'
                      : 'bg-surface-400/20 border-surface-400/30 text-surface-500 hover:text-white hover:border-surface-400/60'
                  )}
                >
                  {votingIds.has(ans.id) ? (
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  ) : (
                    <ThumbsUp className="h-2.5 w-2.5" />
                  )}
                  <span>{ans.upvotes}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs font-mono text-surface-500 mb-3 italic">
          No answers yet — be the first.
        </p>
      )}

      {/* Answer form */}
      <form onSubmit={submit} className="flex gap-2">
        <textarea
          ref={textRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a clear, concise answer…"
          rows={2}
          maxLength={1000}
          className={cn(
            'flex-1 resize-none rounded-xl px-3 py-2 text-sm',
            'bg-surface-200 border border-surface-300',
            'text-white placeholder:text-surface-500',
            'focus:outline-none focus:border-purple/60 focus:ring-1 focus:ring-purple/30',
            'transition-colors font-mono'
          )}
        />
        <button
          type="submit"
          disabled={text.trim().length < 10 || submitting}
          aria-label="Post answer"
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl',
            'bg-purple/80 border border-purple/50 text-white',
            'hover:bg-purple transition-colors',
            'disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </form>
      <p className="text-[11px] font-mono text-surface-600 mt-1">
        {text.length}/1000 · Min 10 characters
      </p>
    </div>
  )
}

// ─── Question Card ────────────────────────────────────────────────────────────

interface QuestionCardProps {
  question: HubQuestion
  isExpanded: boolean
  currentUserId: string | null
  sessionAnswered: Set<string>
  onToggle: () => void
  onVote: (id: string, voted: boolean) => void
  onAnswerPosted: (id: string) => void
}

function QuestionCard({
  question,
  isExpanded,
  currentUserId,
  sessionAnswered,
  onToggle,
  onVote,
  onAnswerPosted,
}: QuestionCardProps) {
  const [voting, setVoting] = useState(false)
  const justAnswered = sessionAnswered.has(question.id)

  async function handleVote(e: React.MouseEvent) {
    e.stopPropagation()
    if (voting) return
    setVoting(true)
    try {
      const method = question.user_voted ? 'DELETE' : 'POST'
      await fetch(
        `/api/topics/${question.topic_id}/questions/${question.id}/vote`,
        { method }
      )
      onVote(question.id, !question.user_voted)
    } catch {
      // best-effort
    } finally {
      setVoting(false)
    }
  }

  const t = question.topic

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border transition-colors',
        justAnswered
          ? 'bg-emerald/5 border-emerald/25'
          : isExpanded
          ? 'bg-surface-100 border-purple/30'
          : 'bg-surface-200/60 border-surface-300/60 hover:border-surface-400/60'
      )}
    >
      <div
        className="p-4 cursor-pointer"
        onClick={onToggle}
        role="button"
        aria-expanded={isExpanded}
      >
        {/* Topic breadcrumb */}
        {t && (
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            {t.category && (
              <span className="text-[10px] font-mono font-semibold text-purple uppercase tracking-widest">
                {t.category}
              </span>
            )}
            <span className="text-surface-600 text-[10px]">/</span>
            <Link
              href={`/topic/${t.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors truncate max-w-[260px]"
            >
              {t.statement.length > 60
                ? `${t.statement.slice(0, 60)}…`
                : t.statement}
            </Link>
            <span
              className={cn(
                'text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider flex-shrink-0',
                STATUS_COLOR[t.status] ?? STATUS_COLOR.proposed
              )}
            >
              {t.status === 'law' ? 'LAW' : t.status}
            </span>
          </div>
        )}

        {/* Question content */}
        <p className="text-sm font-medium text-white leading-relaxed mb-3">
          {question.content}
        </p>

        {/* Footer row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {question.author && (
              <div className="flex items-center gap-1.5">
                <Avatar
                  src={question.author.avatar_url}
                  fallback={question.author.display_name || question.author.username}
                  size="xs"
                />
                <Link
                  href={`/profile/${question.author.username}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                >
                  {question.author.display_name || question.author.username}
                </Link>
              </div>
            )}
            <span className="text-[10px] font-mono text-surface-600">
              {relativeTime(question.created_at)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Upvote */}
            <button
              onClick={handleVote}
              disabled={voting}
              aria-label={question.user_voted ? 'Remove upvote' : 'Upvote question'}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono',
                'border transition-all disabled:opacity-50',
                question.user_voted
                  ? 'bg-for-500/20 border-for-500/40 text-for-400'
                  : 'bg-surface-300/40 border-surface-300/60 text-surface-500 hover:text-white hover:border-surface-400/80'
              )}
            >
              {voting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ThumbsUp className="h-3 w-3" />
              )}
              <span>{question.upvotes}</span>
            </button>

            {/* Answer count */}
            <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <MessageSquare className="h-3 w-3" />
              <span>{question.answer_count}</span>
            </div>

            {/* State indicator */}
            {justAnswered ? (
              <span className="flex items-center gap-1 text-[11px] font-mono text-emerald">
                <Check className="h-3 w-3" />
                Answered
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-mono text-purple font-semibold">
                <Zap className="h-3 w-3" />
                Answer
              </span>
            )}

            <ChevronDown
              className={cn(
                'h-4 w-4 text-surface-500 transition-transform flex-shrink-0',
                isExpanded && 'rotate-180'
              )}
            />
          </div>
        </div>
      </div>

      {/* Inline answer sheet */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              <AnswerSheet
                question={question}
                currentUserId={currentUserId}
                onAnswerPosted={() => onAnswerPosted(question.id)}
              />
              <div className="mt-3 pt-3 border-t border-surface-300/40">
                <Link
                  href={`/questions/${question.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 text-[11px] text-surface-500 hover:text-for-400 transition-colors"
                >
                  <ArrowRight className="h-3 w-3" />
                  View full thread permalink
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function UnansweredClient() {
  const [questions, setQuestions]   = useState<HubQuestion[]>([])
  const [total, setTotal]           = useState(0)
  const [loading, setLoading]       = useState(true)
  const [sort, setSort]             = useState<SortId>('top')
  const [category, setCategory]     = useState('All')
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [showCats, setShowCats]     = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [sessionAnswered, setSessionAnswered] = useState<Set<string>>(new Set())

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null)
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setExpanded(null)
    try {
      const params = new URLSearchParams({
        filter: 'unanswered',
        sort,
        ...(category !== 'All' ? { category } : {}),
        limit: '40',
      })
      const res = await fetch(`/api/questions?${params}`)
      if (res.ok) {
        const data = (await res.json()) as HubQuestionsResponse
        setQuestions(data.questions)
        setTotal(data.total)
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [sort, category])

  useEffect(() => { load() }, [load])

  function handleVote(id: string, voted: boolean) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id
          ? { ...q, user_voted: voted, upvotes: q.upvotes + (voted ? 1 : -1) }
          : q
      )
    )
  }

  function handleAnswerPosted(id: string) {
    setSessionAnswered((prev) => new Set(prev).add(id))
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id
          ? { ...q, answer_count: q.answer_count + 1 }
          : q
      )
    )
  }

  const answeredCount = sessionAnswered.size

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30">
              <Inbox className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Answer Queue</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Unanswered questions across all debates
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/questions"
              aria-label="Back to Q&A Hub"
              className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-surface-200 border border-surface-300 text-surface-500 hover:text-purple hover:border-purple/40 transition-colors text-xs font-mono"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">All Q&amp;A</span>
            </Link>
            <button
              onClick={load}
              aria-label="Refresh"
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Session progress bar */}
        <AnimatePresence>
          {answeredCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl bg-emerald/5 border border-emerald/20"
            >
              <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-emerald/15 border border-emerald/30 flex-shrink-0">
                <Check className="h-3.5 w-3.5 text-emerald" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono font-semibold text-emerald">
                  {answeredCount} {answeredCount === 1 ? 'question' : 'questions'} answered this session
                </p>
                <p className="text-[11px] font-mono text-surface-500">
                  Your answers help the community understand every debate.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sort + Category bar */}
        <div className="flex items-center gap-2 flex-wrap mb-6">
          {SORT_OPTS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSort(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
                'border transition-all',
                sort === id
                  ? 'bg-for-500/20 border-for-500/40 text-for-400'
                  : 'bg-surface-300/50 border-surface-300/60 text-surface-500 hover:text-white'
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}

          <div className="relative ml-auto">
            <button
              onClick={() => setShowCats((s) => !s)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
                'border transition-all',
                category !== 'All'
                  ? 'bg-gold/20 border-gold/40 text-gold'
                  : 'bg-surface-300/50 border-surface-300/60 text-surface-500 hover:text-white'
              )}
            >
              <Filter className="h-3 w-3" />
              {category}
              <ChevronDown className={cn('h-3 w-3 transition-transform', showCats && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {showCats && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.96 }}
                  className={cn(
                    'absolute right-0 top-full mt-1 z-50',
                    'bg-surface-200 border border-surface-300 rounded-xl shadow-2xl',
                    'min-w-[160px] py-1 overflow-hidden'
                  )}
                >
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setCategory(cat); setShowCats(false) }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs font-mono transition-colors',
                        cat === category
                          ? 'text-gold bg-gold/10'
                          : 'text-surface-400 hover:text-white hover:bg-surface-300/50'
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Stats strip */}
        {!loading && total > 0 && (
          <div className="flex items-center gap-2 mb-4 text-xs font-mono text-surface-500">
            <HelpCircle className="h-3.5 w-3.5 text-purple" />
            <span>
              {total} unanswered {total === 1 ? 'question' : 'questions'} waiting
              {category !== 'All' && ` in ${category}`}
            </span>
          </div>
        )}

        {/* Questions list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-surface-200/60 border border-surface-300/60 p-4">
                <Skeleton className="h-3 w-1/3 rounded mb-2" />
                <Skeleton className="h-4 w-full rounded mb-1" />
                <Skeleton className="h-4 w-5/6 rounded mb-3" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-24 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : questions.length === 0 ? (
          <EmptyState
            icon={Check}
            title="Queue cleared"
            description={
              category !== 'All'
                ? `No unanswered questions in ${category}. Try a different category or browse all.`
                : 'Every question has been answered. Check back soon — new questions come in from every debate.'
            }
            action={
              <div className="flex items-center gap-3 justify-center">
                <button
                  onClick={() => setCategory('All')}
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-white transition-colors"
                >
                  All categories
                </button>
                <Link
                  href="/questions"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-purple hover:text-white transition-colors"
                >
                  Browse all Q&amp;A
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            }
          />
        ) : (
          <div className="space-y-3">
            {questions.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                isExpanded={expanded === q.id}
                currentUserId={currentUserId}
                sessionAnswered={sessionAnswered}
                onToggle={() => setExpanded((prev) => (prev === q.id ? null : q.id))}
                onVote={handleVote}
                onAnswerPosted={handleAnswerPosted}
              />
            ))}
          </div>
        )}

        {/* CTA */}
        {!loading && (
          <div className="mt-8 rounded-2xl bg-purple/5 border border-purple/20 p-5 text-center">
            <Inbox className="h-8 w-8 text-purple mx-auto mb-2 opacity-60" />
            <p className="text-sm font-mono font-semibold text-white mb-1">
              Ask a question about a specific debate
            </p>
            <p className="text-xs font-mono text-surface-500 mb-4">
              Navigate to any topic and click &ldquo;Community Q&amp;A&rdquo; to post a clarifying question.
            </p>
            <Link
              href="/"
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-xl',
                'bg-purple/80 border border-purple/50 text-white text-xs font-mono font-semibold',
                'hover:bg-purple transition-colors'
              )}
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Browse Topics
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
