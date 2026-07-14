'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquare,
  Mic,
  Reply,
  ScrollText,
  Send,
  ThumbsUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Minister {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  bio: string | null
}

interface Responder {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

interface Question {
  id: string
  content: string
  upvotes: number
  created_at: string
  ministerial_response: string | null
  responded_at: string | null
  questioner: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string } | null
  responder: Responder | null
}

interface RelatedTopic {
  id: string
  statement: string
  status: string
}

interface Statement {
  id: string
  title: string
  summary: string | null
  body: string
  department: string
  category: string
  statement_type: 'oral' | 'written'
  question_count: number
  upvote_count: number
  published_at: string
  topic_id: string | null
  minister: Minister | null
}

// ─── Config ───────────────────────────────────────────────────────────────────


const DEPT_BADGE: Record<string, string> = {
  treasury:        'bg-gold/10 border-gold/25 text-gold',
  health:          'bg-emerald/10 border-emerald/25 text-emerald',
  education:       'bg-for-900/30 border-for-700/20 text-for-300',
  'home-affairs':  'bg-against-900/30 border-against-700/20 text-against-300',
  'foreign-affairs': 'bg-purple/10 border-purple/25 text-purple',
  environment:     'bg-emerald/10 border-emerald/25 text-emerald',
  transport:       'bg-for-900/20 border-for-800/20 text-for-400',
  housing:         'bg-gold/10 border-gold/20 text-gold',
  science:         'bg-purple/10 border-purple/25 text-purple',
  culture:         'bg-against-900/20 border-against-700/20 text-against-300',
  justice:         'bg-against-900/20 border-against-700/20 text-against-400',
  parliament:      'bg-for-900/20 border-for-600/20 text-for-300',
}

function deptLabel(dept: string) {
  return dept.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ─── Question row ─────────────────────────────────────────────────────────────

function QuestionRow({
  question,
  isMinister,
  upvoted,
  onUpvote,
  onRespond,
}: {
  question: Question
  isMinister: boolean
  upvoted: boolean
  onUpvote: (id: string) => void
  onRespond: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const hasResponse = !!question.ministerial_response

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border transition-colors',
        hasResponse
          ? 'bg-surface-100 border-for-500/20'
          : 'bg-surface-100 border-surface-300'
      )}
    >
      <div className="p-4">
        {/* Questioner */}
        <div className="flex items-start gap-2.5 mb-2.5">
          <Avatar
            src={question.questioner?.avatar_url}
            fallback={question.questioner?.display_name || question.questioner?.username || '?'}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Link
                href={`/profile/${question.questioner?.username}`}
                className="text-xs font-semibold text-white hover:text-for-400 transition-colors"
              >
                {question.questioner?.display_name || question.questioner?.username}
              </Link>
              {question.questioner?.role && question.questioner.role !== 'person' && (
                <Badge variant={question.questioner.role as 'person' | 'debator' | 'troll_catcher' | 'elder'}>
                  {question.questioner.role}
                </Badge>
              )}
              <span className="ml-auto text-[10px] font-mono text-surface-600 flex-shrink-0">
                {relativeTime(question.created_at)}
              </span>
            </div>
            <p className="text-sm text-surface-700 leading-relaxed">{question.content}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={() => onUpvote(question.id)}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-all',
              upvoted
                ? 'bg-for-500/15 border-for-500/40 text-for-400'
                : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-for-500/30 hover:text-for-400'
            )}
          >
            <ThumbsUp className="h-3 w-3" />
            {question.upvotes > 0 && <span>{question.upvotes}</span>}
            <span>{upvoted ? 'Supported' : 'Support'}</span>
          </button>

          {isMinister && !hasResponse && (
            <button
              onClick={() => onRespond(question.id)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border bg-surface-200 border-surface-300 text-surface-500 hover:border-for-500/30 hover:text-white transition-all"
            >
              <Reply className="h-3 w-3" />
              Respond
            </button>
          )}

          {hasResponse && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Ministerial response
            </button>
          )}
        </div>

        {/* Ministerial response */}
        <AnimatePresence>
          {expanded && hasResponse && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pl-4 border-l-2 border-for-500/30">
                <div className="flex items-center gap-2 mb-1.5">
                  <Avatar
                    src={question.responder?.avatar_url}
                    fallback={question.responder?.display_name || question.responder?.username || '?'}
                    size="xs"
                  />
                  <span className="text-[11px] font-semibold text-for-400">
                    {question.responder?.display_name || question.responder?.username}
                  </span>
                  <span className="text-[10px] font-mono text-for-600 px-1.5 py-0.5 rounded-full bg-for-500/10 border border-for-500/20">
                    Minister
                  </span>
                  {question.responded_at && (
                    <span className="ml-auto text-[10px] font-mono text-surface-600">
                      {relativeTime(question.responded_at)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-surface-600 leading-relaxed">{question.ministerial_response}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─── Main detail client ───────────────────────────────────────────────────────

export function MinisterialStatementDetailClient({ id }: { id: string }) {
  const [statement, setStatement]       = useState<Statement | null>(null)
  const [questions, setQuestions]       = useState<Question[]>([])
  const [userQuestion, setUserQuestion] = useState<string | null>(null)
  const [upvotedStat, setUpvotedStat]   = useState(false)
  const [upvotedQs, setUpvotedQs]       = useState<string[]>([])
  const [userId, setUserId]             = useState<string | null>(null)
  const [relatedTopic, setRelatedTopic] = useState<RelatedTopic | null>(null)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)

  // New question form
  const [questionText, setQuestionText] = useState('')
  const [submittingQ, setSubmittingQ]   = useState(false)
  const [qError, setQError]             = useState<string | null>(null)

  // Ministerial response form
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  const [responseText, setResponseText] = useState('')
  const [submittingR, setSubmittingR]   = useState(false)
  const [rError, setRError]             = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ministerial-statements/${id}`)
      if (!res.ok) { setError('Statement not found.'); setLoading(false); return }
      const json = await res.json()
      setStatement(json.statement)
      setQuestions(json.questions ?? [])
      setUserQuestion(json.userQuestion ?? null)
      setUpvotedStat(json.userUpvotedStatements ?? false)
      setUpvotedQs(json.userUpvotedQuestions ?? [])
      setUserId(json.userId ?? null)
      setRelatedTopic(json.relatedTopic ?? null)
    } catch {
      setError('Failed to load statement.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleStatementUpvote() {
    if (!userId || !statement) return
    const was = upvotedStat
    setUpvotedStat(!was)
    setStatement((s) => s ? { ...s, upvote_count: s.upvote_count + (was ? -1 : 1) } : s)
    await fetch(`/api/ministerial-statements/${id}/upvote`, { method: 'POST' }).catch(() => {
      setUpvotedStat(was)
    })
  }

  async function handleQuestionUpvote(qId: string) {
    if (!userId) return
    const was = upvotedQs.includes(qId)
    setUpvotedQs((prev) => was ? prev.filter((u) => u !== qId) : [...prev, qId])
    setQuestions((prev) => prev.map((q) => q.id === qId ? { ...q, upvotes: q.upvotes + (was ? -1 : 1) } : q))
    await fetch(`/api/ministerial-statements/${id}/upvote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: qId }),
    }).catch(() => {
      setUpvotedQs((prev) => was ? [...prev, qId] : prev.filter((u) => u !== qId))
    })
  }

  async function handleSubmitQuestion(e: React.FormEvent) {
    e.preventDefault()
    if (submittingQ || !userId) return
    setQError(null)
    setSubmittingQ(true)
    try {
      const res = await fetch(`/api/ministerial-statements/${id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: questionText }),
      })
      const json = await res.json()
      if (!res.ok) { setQError(json.error ?? 'Failed to submit'); return }
      setQuestions((prev) => [json.question, ...prev])
      setUserQuestion(json.question.id)
      setQuestionText('')
    } catch {
      setQError('Network error — please try again.')
    } finally {
      setSubmittingQ(false)
    }
  }

  async function handleSubmitResponse(e: React.FormEvent) {
    e.preventDefault()
    if (submittingR || !respondingTo) return
    setRError(null)
    setSubmittingR(true)
    try {
      const res = await fetch(`/api/ministerial-statements/${id}/questions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: respondingTo, response: responseText }),
      })
      const json = await res.json()
      if (!res.ok) { setRError(json.error ?? 'Failed'); return }
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === respondingTo
            ? {
                ...q,
                ministerial_response: json.question.ministerial_response,
                responded_at: json.question.responded_at,
                responder: statement?.minister
                  ? { id: statement.minister.id, username: statement.minister.username, display_name: statement.minister.display_name, avatar_url: statement.minister.avatar_url }
                  : null,
              }
            : q
        )
      )
      setRespondingTo(null)
      setResponseText('')
    } catch {
      setRError('Network error')
    } finally {
      setSubmittingR(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <div className="flex items-center justify-center pt-32">
          <Loader2 className="h-6 w-6 text-surface-500 animate-spin" />
        </div>
        <BottomNav />
      </div>
    )
  }

  if (error || !statement) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <AlertCircle className="h-10 w-10 text-against-400 mx-auto mb-3" />
          <p className="text-surface-500 text-sm">{error ?? 'Statement not found.'}</p>
          <Link href="/ministerial-statements" className="mt-4 inline-block text-xs text-for-400 hover:text-for-300 transition-colors">
            ← Back to Ministerial Statements
          </Link>
        </div>
        <BottomNav />
      </div>
    )
  }

  const isOral = statement.statement_type === 'oral'
  const deptBadgeClass = DEPT_BADGE[statement.department] ?? 'bg-surface-200 border-surface-400 text-surface-400'
  const isMyStatement = userId === statement.minister?.id
  const canQuestion = userId && !isMyStatement && !userQuestion

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* Back button */}
        <Link
          href="/ministerial-statements"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Ministerial Statements
        </Link>

        {/* Statement header */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 mb-5">
          {/* Minister info */}
          <div className="flex items-start gap-3 mb-5">
            <Link href={`/profile/${statement.minister?.username}`}>
              <Avatar
                src={statement.minister?.avatar_url}
                fallback={statement.minister?.display_name || statement.minister?.username || '?'}
                size="lg"
              />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/profile/${statement.minister?.username}`}
                  className="text-sm font-bold text-white hover:text-for-400 transition-colors"
                >
                  {statement.minister?.display_name || statement.minister?.username}
                </Link>
                {statement.minister?.role && statement.minister.role !== 'person' && (
                  <Badge variant={statement.minister.role as 'person' | 'debator' | 'troll_catcher' | 'elder'}>
                    {statement.minister.role}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-surface-500 mt-0.5">
                @{statement.minister?.username}
              </p>
              {statement.minister?.bio && (
                <p className="text-xs text-surface-600 mt-1 line-clamp-1">{statement.minister.bio}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                  deptBadgeClass
                )}
              >
                <Building2 className="h-2.5 w-2.5" />
                {deptLabel(statement.department)}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                  isOral
                    ? 'bg-for-500/10 border-for-500/25 text-for-400'
                    : 'bg-surface-300/40 border-surface-400/40 text-surface-500'
                )}
              >
                {isOral ? <Mic className="h-2.5 w-2.5" /> : <ScrollText className="h-2.5 w-2.5" />}
                {isOral ? 'Oral' : 'Written'}
              </span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-lg font-bold text-white leading-snug mb-4">
            {statement.title}
          </h1>

          {/* Body */}
          <div className="text-sm text-surface-600 leading-relaxed whitespace-pre-line mb-5">
            {statement.body}
          </div>

          {/* Related topic */}
          {relatedTopic && (
            <Link
              href={`/topic/${relatedTopic.id}`}
              className="flex items-center gap-2 p-3 rounded-xl bg-surface-200/60 border border-surface-300/80 hover:border-for-500/30 transition-colors mb-5 group"
            >
              <FileText className="h-4 w-4 text-surface-500 flex-shrink-0" />
              <span className="text-xs text-surface-500 group-hover:text-white transition-colors flex-1 line-clamp-1">
                {relatedTopic.statement}
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-surface-600 flex-shrink-0" />
            </Link>
          )}

          {/* Meta footer */}
          <div className="flex items-center gap-4 text-xs text-surface-500 pt-3 border-t border-surface-300">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {new Date(statement.published_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </span>
            <span className="font-mono">{statement.category}</span>
            <div className="ml-auto flex items-center gap-3">
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {statement.question_count}
              </span>
              <button
                onClick={handleStatementUpvote}
                disabled={!userId}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-mono font-semibold transition-all',
                  upvotedStat
                    ? 'bg-for-600/20 border-for-600/50 text-for-400'
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-for-500/40 hover:text-for-400 disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <ThumbsUp className="h-3 w-3" />
                {statement.upvote_count > 0 && <span>{statement.upvote_count}</span>}
                {upvotedStat ? 'Endorsed' : 'Endorse'}
              </button>
            </div>
          </div>
        </div>

        {/* Questions section */}
        <div className="mb-4">
          <h2 className="text-sm font-bold text-white font-mono mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-surface-500" />
            Supplementary Questions
            {questions.length > 0 && (
              <span className="text-xs font-mono text-surface-500 font-normal">({questions.length})</span>
            )}
          </h2>

          {/* Question form */}
          {canQuestion && (
            <form onSubmit={handleSubmitQuestion} className="mb-4">
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                <p className="text-xs text-surface-500 mb-2.5 font-mono">
                  Ask a supplementary question of the Minister
                </p>
                <textarea
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Will the Minister explain how this statement aligns with..."
                  rows={3}
                  maxLength={500}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm text-white placeholder-surface-600 focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/20 resize-none mb-2.5"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-surface-600">{questionText.length}/500</span>
                  <button
                    type="submit"
                    disabled={submittingQ || questionText.length < 10}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-for-600 text-white text-xs font-mono font-semibold hover:bg-for-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {submittingQ ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Submit Question
                  </button>
                </div>
                {qError && (
                  <p className="text-xs text-against-400 mt-2 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {qError}
                  </p>
                )}
              </div>
            </form>
          )}

          {userQuestion && !isMyStatement && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-for-500/8 border border-for-500/20 text-xs text-for-400 mb-4">
              <Check className="h-3.5 w-3.5 flex-shrink-0" />
              You have submitted a supplementary question.
            </div>
          )}

          {/* Ministerial response form */}
          <AnimatePresence>
            {respondingTo && (
              <motion.form
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onSubmit={handleSubmitResponse}
                className="mb-4 rounded-xl bg-for-500/8 border border-for-500/25 p-4"
              >
                <p className="text-xs font-semibold text-for-400 mb-2">Ministerial Response</p>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="I thank the citizen for that question. The government's position is..."
                  rows={3}
                  maxLength={1000}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm text-white placeholder-surface-600 focus:outline-none focus:border-for-500/60 resize-none mb-2"
                />
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => { setRespondingTo(null); setResponseText('') }}
                    className="text-xs text-surface-500 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingR || responseText.length < 10}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-for-600 text-white text-xs font-mono font-semibold hover:bg-for-500 disabled:opacity-50 transition-all"
                  >
                    {submittingR ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Reply className="h-3.5 w-3.5" />}
                    Issue Response
                  </button>
                </div>
                {rError && <p className="text-xs text-against-400 mt-2">{rError}</p>}
              </motion.form>
            )}
          </AnimatePresence>

          {/* Questions list */}
          {questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <MessageSquare className="h-8 w-8 text-surface-500 mx-auto mb-3" />
              <p className="text-sm text-surface-500">No supplementary questions yet.</p>
              {canQuestion && (
                <p className="text-xs text-surface-600 mt-1">Be the first to question the Minister.</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {questions.map((q) => (
                  <QuestionRow
                    key={q.id}
                    question={q}
                    isMinister={isMyStatement}
                    upvoted={upvotedQs.includes(q.id)}
                    onUpvote={handleQuestionUpvote}
                    onRespond={(qId) => {
                      setRespondingTo(qId)
                      setResponseText('')
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Back link */}
        <Link
          href="/ministerial-statements"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mt-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Ministerial Statements
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
