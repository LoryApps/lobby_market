'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic,
  ChevronUp,
  MessageSquare,
  Calendar,
  Clock,
  Building2,
  CheckCircle2,
  ChevronRight,
  Send,
  ArrowLeft,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

interface OralSession {
  id: string
  department: string
  department_slug: string
  spokesperson_name: string | null
  spokesperson_avatar_url: string | null
  week_start: string
  week_end: string
  is_active: boolean
  session_notes: string | null
}

interface OralAnswer {
  id: string
  answer_text: string
  answered_by: string | null
  created_at: string
}

interface OralQuestion {
  id: string
  question_text: string
  upvotes: number
  is_selected: boolean
  is_answered: boolean
  created_at: string
  author: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null
  answers: OralAnswer[]
}

interface OralQuestionsData {
  session: OralSession | null
  questions: OralQuestion[]
  userUpvotes: string[]
  userId: string | null
}

const DEPT_COLORS: Record<string, string> = {
  treasury:       'text-gold',
  health:         'text-emerald',
  education:      'text-for-400',
  'home-affairs': 'text-against-400',
  'foreign-affairs': 'text-purple',
  environment:    'text-emerald',
  transport:      'text-for-300',
  housing:        'text-gold',
  science:        'text-purple',
  culture:        'text-against-300',
}

const DEPT_BG: Record<string, string> = {
  treasury:       'bg-gold/10 border-gold/20',
  health:         'bg-emerald/10 border-emerald/20',
  education:      'bg-for-900/30 border-for-700/20',
  'home-affairs': 'bg-against-900/30 border-against-700/20',
  'foreign-affairs': 'bg-purple/10 border-purple/20',
  environment:    'bg-emerald/10 border-emerald/20',
  transport:      'bg-for-900/20 border-for-800/20',
  housing:        'bg-gold/10 border-gold/20',
  science:        'bg-purple/10 border-purple/20',
  culture:        'bg-against-900/20 border-against-800/20',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function OralQuestionsClient() {
  const [data, setData] = useState<OralQuestionsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'questions' | 'archive'>('questions')
  const [archive, setArchive] = useState<OralSession[]>([])
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [question, setQuestion] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [upvoting, setUpvoting] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async (sessionId?: string) => {
    setLoading(true)
    try {
      const url = sessionId
        ? `/api/oral-questions?session_id=${sessionId}`
        : '/api/oral-questions'
      const res = await fetch(url)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  const loadArchive = useCallback(async () => {
    if (archiveLoading || archive.length) return
    setArchiveLoading(true)
    try {
      const res = await fetch('/api/oral-questions?archive=true')
      if (res.ok) {
        const json = await res.json()
        setArchive(json.sessions ?? [])
      }
    } finally {
      setArchiveLoading(false)
    }
  }, [archiveLoading, archive.length])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (tab === 'archive') loadArchive()
  }, [tab, loadArchive])

  const handleSubmit = async () => {
    if (!question.trim() || !data?.session) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/oral-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', session_id: data.session.id, question_text: question }),
      })
      const json = await res.json()
      if (!res.ok) { setSubmitError(json.error ?? 'Failed to submit'); return }
      setSubmitted(true)
      setQuestion('')
      setTimeout(() => setSubmitted(false), 3000)
      load()
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpvote = async (questionId: string) => {
    if (!data?.userId || upvoting[questionId]) return
    setUpvoting(u => ({ ...u, [questionId]: true }))
    try {
      const res = await fetch('/api/oral-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upvote', question_id: questionId }),
      })
      if (res.ok) {
        const { voted } = await res.json()
        setData(prev => {
          if (!prev) return prev
          return {
            ...prev,
            userUpvotes: voted
              ? [...prev.userUpvotes, questionId]
              : prev.userUpvotes.filter(id => id !== questionId),
            questions: prev.questions.map(q =>
              q.id === questionId
                ? { ...q, upvotes: q.upvotes + (voted ? 1 : -1) }
                : q
            ),
          }
        })
      }
    } finally {
      setUpvoting(u => ({ ...u, [questionId]: false }))
    }
  }

  const session = data?.session
  const deptSlug = session?.department_slug ?? ''
  const deptColor = DEPT_COLORS[deptSlug] ?? 'text-for-400'
  const deptBg = DEPT_BG[deptSlug] ?? 'bg-surface-800/40 border-surface-700/30'
  const charCount = question.length
  const charOk = charCount >= 10 && charCount <= 500

  return (
    <div className="min-h-screen bg-surface-950">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-20 pb-28">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-2 mb-1">
            <Mic className="w-5 h-5 text-gold" />
            <h1 className="text-xl font-bold text-white">Oral Questions</h1>
          </div>
          <p className="text-sm text-surface-400">
            Each week a government department faces the chamber. Submit and upvote questions to be answered.
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-surface-900 rounded-xl p-1 border border-surface-800">
          {(['questions', 'archive'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 py-2 text-sm font-medium rounded-lg transition-all',
                tab === t
                  ? 'bg-surface-700 text-white'
                  : 'text-surface-400 hover:text-white'
              )}
            >
              {t === 'questions' ? 'This Week' : 'Archive'}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'questions' && (
            <motion.div
              key="questions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Session card */}
              {loading ? (
                <div className="space-y-3 mb-6">
                  <Skeleton className="h-28 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                </div>
              ) : session ? (
                <>
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'rounded-xl border p-4 mb-5',
                      deptBg
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 className={cn('w-4 h-4', deptColor)} />
                          <span className="text-xs text-surface-400 font-medium uppercase tracking-wider">
                            Department in the Chamber
                          </span>
                        </div>
                        <h2 className={cn('text-lg font-bold mb-1', deptColor)}>
                          {session.department}
                        </h2>
                        {session.spokesperson_name && (
                          <p className="text-sm text-surface-300">{session.spokesperson_name}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs border-surface-600 text-surface-300">
                        Live
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-surface-700/40">
                      <div className="flex items-center gap-1.5 text-xs text-surface-400">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDate(session.week_start)} – {formatDate(session.week_end)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-surface-400">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{data.questions.length} question{data.questions.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Question submission */}
                  {data.userId ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 }}
                      className="rounded-xl border border-surface-700/50 bg-surface-900 p-4 mb-5"
                    >
                      <p className="text-sm font-medium text-white mb-3">Ask the department a question</p>
                      <textarea
                        ref={textareaRef}
                        value={question}
                        onChange={e => setQuestion(e.target.value)}
                        placeholder="What would you like the department to address? Be specific and constructive."
                        rows={3}
                        className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white placeholder-surface-500 resize-none focus:outline-none focus:border-surface-500 transition-colors"
                      />
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'text-xs',
                            charCount > 500 ? 'text-against-400' : charCount >= 10 ? 'text-surface-400' : 'text-surface-500'
                          )}>
                            {charCount}/500
                          </span>
                          {submitError && (
                            <span className="text-xs text-against-400">{submitError}</span>
                          )}
                          {submitted && (
                            <span className="flex items-center gap-1 text-xs text-emerald">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Submitted
                            </span>
                          )}
                        </div>
                        <button
                          onClick={handleSubmit}
                          disabled={submitting || !charOk}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                            charOk && !submitting
                              ? 'bg-for-600 hover:bg-for-500 text-white'
                              : 'bg-surface-700 text-surface-500 cursor-not-allowed'
                          )}
                        >
                          <Send className="w-3.5 h-3.5" />
                          {submitting ? 'Submitting…' : 'Submit'}
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="rounded-xl border border-surface-700/50 bg-surface-900/50 p-4 mb-5 text-center">
                      <p className="text-sm text-surface-400 mb-2">Sign in to submit and upvote questions</p>
                      <Link href="/login" className="text-sm text-for-400 hover:text-for-300 underline">
                        Sign in
                      </Link>
                    </div>
                  )}

                  {/* Questions list */}
                  {data.questions.length === 0 ? (
                    <EmptyState
                      icon={MessageSquare}
                      title="No questions yet"
                      description="Be the first to ask the department a question this week."
                    />
                  ) : (
                    <div className="space-y-3">
                      {data.questions.map((q, idx) => {
                        const hasUpvoted = data.userUpvotes.includes(q.id)
                        const isExpanded = expanded === q.id
                        return (
                          <motion.div
                            key={q.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.04 }}
                            className={cn(
                              'rounded-xl border bg-surface-900 overflow-hidden transition-colors',
                              q.is_selected
                                ? 'border-gold/30'
                                : 'border-surface-700/50 hover:border-surface-600/60'
                            )}
                          >
                            <div className="p-4">
                              <div className="flex gap-3">
                                {/* Upvote */}
                                <button
                                  onClick={() => handleUpvote(q.id)}
                                  disabled={!data.userId || upvoting[q.id]}
                                  className={cn(
                                    'flex flex-col items-center gap-0.5 min-w-[36px] pt-0.5 transition-colors',
                                    hasUpvoted
                                      ? 'text-for-400'
                                      : 'text-surface-500 hover:text-surface-300',
                                    !data.userId && 'cursor-default'
                                  )}
                                  aria-label={hasUpvoted ? 'Remove upvote' : 'Upvote question'}
                                  aria-pressed={hasUpvoted}
                                >
                                  <ChevronUp className={cn('w-5 h-5', upvoting[q.id] && 'opacity-50')} />
                                  <span className="text-xs font-semibold leading-none">{q.upvotes}</span>
                                </button>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2">
                                      {q.author && (
                                        <Avatar
                                          src={q.author.avatar_url}
                                          name={q.author.display_name ?? q.author.username}
                                          size="xs"
                                        />
                                      )}
                                      <span className="text-xs text-surface-400">
                                        {q.author?.display_name ?? q.author?.username ?? 'Citizen'}
                                      </span>
                                      <span className="text-xs text-surface-600">·</span>
                                      <span className="text-xs text-surface-500">{timeAgo(q.created_at)}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {q.is_selected && (
                                        <Badge variant="outline" className="text-xs border-gold/40 text-gold px-1.5 py-0">
                                          Selected
                                        </Badge>
                                      )}
                                      {q.is_answered && (
                                        <Badge variant="outline" className="text-xs border-emerald/40 text-emerald px-1.5 py-0">
                                          Answered
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  <p className="text-sm text-white leading-relaxed">{q.question_text}</p>

                                  {q.answers.length > 0 && (
                                    <button
                                      onClick={() => setExpanded(isExpanded ? null : q.id)}
                                      className="flex items-center gap-1 mt-2 text-xs text-for-400 hover:text-for-300 transition-colors"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5" />
                                      {q.answers.length} answer{q.answers.length !== 1 ? 's' : ''}
                                      <ChevronRight className={cn('w-3.5 h-3.5 transition-transform', isExpanded && 'rotate-90')} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            <AnimatePresence>
                              {isExpanded && q.answers.map(ans => (
                                <motion.div
                                  key={ans.id}
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className={cn('border-t px-4 py-3 overflow-hidden', deptBg)}
                                >
                                  <div className="flex items-center gap-1.5 mb-1.5">
                                    <Building2 className={cn('w-3.5 h-3.5', deptColor)} />
                                    <span className={cn('text-xs font-semibold', deptColor)}>
                                      {ans.answered_by ?? session.spokesperson_name ?? session.department}
                                    </span>
                                    <span className="text-xs text-surface-500">· {timeAgo(ans.created_at)}</span>
                                  </div>
                                  <p className="text-sm text-surface-200 leading-relaxed">{ans.answer_text}</p>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          </motion.div>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : (
                <EmptyState
                  icon={Clock}
                  title="No active session"
                  description="There is no department session scheduled for this week."
                />
              )}
            </motion.div>
          )}

          {tab === 'archive' && (
            <motion.div
              key="archive"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {archiveLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : archive.length === 0 ? (
                <EmptyState
                  icon={Calendar}
                  title="No past sessions"
                  description="Completed departmental question sessions will appear here."
                />
              ) : (
                <div className="space-y-2">
                  {archive.map((s, idx) => {
                    const color = DEPT_COLORS[s.department_slug] ?? 'text-for-400'
                    return (
                      <motion.button
                        key={s.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        onClick={() => { setTab('questions'); load(s.id) }}
                        className="w-full flex items-center justify-between gap-3 rounded-xl border border-surface-700/50 bg-surface-900 px-4 py-3 hover:border-surface-600/60 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm font-semibold truncate', color)}>{s.department}</p>
                          <p className="text-xs text-surface-400 mt-0.5">
                            {formatDate(s.week_start)} – {formatDate(s.week_end)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {s.is_active && (
                            <Badge variant="outline" className="text-xs border-emerald/40 text-emerald px-1.5 py-0">
                              Live
                            </Badge>
                          )}
                          <ChevronRight className="w-4 h-4 text-surface-500" />
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Back nav */}
        <div className="mt-8 flex items-center gap-2">
          <Link
            href="/hub"
            className="flex items-center gap-1.5 text-sm text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            All features
          </Link>
          <span className="text-surface-600">·</span>
          <Link href="/pmqs" className="text-sm text-surface-400 hover:text-white transition-colors">
            PMQs
          </Link>
          <span className="text-surface-600">·</span>
          <Link href="/civic-questions" className="text-sm text-surface-400 hover:text-white transition-colors">
            Questions Time
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
