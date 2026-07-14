'use client'

/**
 * /urgent-questions — Westminster-style Urgent Questions
 *
 * Citizens can table a question demanding an immediate ministerial response.
 * Other citizens "second" the question to signal urgency. Once a question
 * reaches 5 seconds it becomes "certified urgent" and surfaces to the top.
 * The addressed minister (or any high-rep citizen) may respond, after which
 * others can ask supplementary questions.
 *
 * Each citizen may table 1 UQ per 24 hours.
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
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Scale,
  Shield,
  Users,
  Zap,
  X,
  Bell,
  CheckCircle2,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { UrgentQuestion, UQListResponse } from '@/app/api/urgent-questions/route'

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'expired'
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 60) return `${m}m remaining`
  return `${h}h remaining`
}

const STATUS_CONFIG = {
  submitted: { label: 'Submitted', color: 'text-surface-500', bg: 'bg-surface-300/50 border-surface-400/30' },
  certified: { label: 'Certified Urgent', color: 'text-gold', bg: 'bg-gold/10 border-gold/30' },
  answered: { label: 'Answered', color: 'text-emerald', bg: 'bg-emerald/10 border-emerald/30' },
  expired: { label: 'Expired', color: 'text-surface-500', bg: 'bg-surface-200/30 border-surface-300/20' },
} as const

// ── Skeleton ──────────────────────────────────────────────────────────────────

function UQSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-200/60 border border-surface-300/40 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-20 ml-auto" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Submit Form ───────────────────────────────────────────────────────────────

interface SubmitFormProps {
  onSubmit: () => void
  onClose: () => void
}

function SubmitForm({ onSubmit, onClose }: SubmitFormProps) {
  const [questionText, setQuestionText] = useState('')
  const [contextNote, setContextNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (questionText.trim().length < 20) {
      setError('Question must be at least 20 characters')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/urgent-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_text: questionText.trim(),
          context_note: contextNote.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Submission failed')
        return
      }
      onSubmit()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="rounded-2xl bg-surface-200/80 border border-gold/30 p-5 mb-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-gold" />
          <h3 className="font-mono text-sm font-bold text-white">Table an Urgent Question</h3>
        </div>
        <button onClick={onClose} className="text-surface-500 hover:text-surface-700 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-mono font-semibold text-surface-500 mb-1.5 uppercase tracking-wider">
            Your urgent question <span className="text-against-400">*</span>
          </label>
          <textarea
            ref={textareaRef}
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="Will the minister explain what urgent action the government is taking on…"
            className={cn(
              'w-full rounded-xl bg-surface-100/80 border px-4 py-3 text-sm text-white placeholder:text-surface-600',
              'focus:outline-none focus:ring-1 resize-none transition-colors',
              questionText.length < 20
                ? 'border-surface-400/40 focus:border-gold/40 focus:ring-gold/20'
                : 'border-gold/40 focus:border-gold/60 focus:ring-gold/20',
            )}
          />
          <p className={cn(
            'text-right text-xs mt-1 font-mono',
            questionText.length > 280 ? 'text-against-400' : 'text-surface-600'
          )}>
            {questionText.length}/300
          </p>
        </div>

        <div>
          <label className="block text-xs font-mono font-semibold text-surface-500 mb-1.5 uppercase tracking-wider">
            Context / background <span className="text-surface-600">(optional)</span>
          </label>
          <textarea
            value={contextNote}
            onChange={(e) => setContextNote(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Why is this question urgent? What recent events prompted it?"
            className="w-full rounded-xl bg-surface-100/80 border border-surface-400/40 px-4 py-3 text-sm text-white placeholder:text-surface-600 focus:outline-none focus:border-surface-500/60 focus:ring-1 focus:ring-surface-500/20 resize-none transition-colors"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-against-400 text-xs bg-against-500/10 border border-against-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-surface-600 font-mono">1 urgent question per 24 hours</p>
          <Button type="submit" size="sm" disabled={submitting || questionText.trim().length < 20}>
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
            Table Question
          </Button>
        </div>
      </form>
    </motion.div>
  )
}

// ── Response Form ─────────────────────────────────────────────────────────────

interface ResponseFormProps {
  questionId: string
  isOfficial: boolean
  type: 'respond' | 'supplementary'
  onSubmit: () => void
  onClose: () => void
}

function ResponseForm({ questionId, isOfficial, type, onSubmit, onClose }: ResponseFormProps) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const maxLen = type === 'respond' ? 1000 : 300
  const minLen = type === 'respond' ? 20 : 10

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (text.trim().length < minLen) {
      setError(`Must be at least ${minLen} characters`)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/urgent-questions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: type,
          question_id: questionId,
          ...(type === 'respond' ? { response_text: text.trim(), is_official: isOfficial } : { supplementary: text.trim() }),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      onSubmit()
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 border-t border-surface-300/30 pt-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={maxLen}
        rows={type === 'respond' ? 4 : 2}
        placeholder={
          type === 'respond'
            ? isOfficial ? 'Provide an official ministerial response…' : 'Provide a response to this question…'
            : 'Ask a supplementary question…'
        }
        autoFocus
        className="w-full rounded-xl bg-surface-100/80 border border-surface-400/40 px-4 py-3 text-sm text-white placeholder:text-surface-600 focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/20 resize-none transition-colors"
      />
      {error && <p className="text-xs text-against-400">{error}</p>}
      <div className="flex items-center gap-2 justify-end">
        <button type="button" onClick={onClose} className="text-xs text-surface-500 hover:text-surface-700 font-mono transition-colors">
          Cancel
        </button>
        <Button type="submit" size="sm" disabled={submitting || text.trim().length < minLen}>
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {type === 'respond' ? 'Submit Response' : 'Ask Supplementary'}
        </Button>
      </div>
    </form>
  )
}

// ── UQ Card ───────────────────────────────────────────────────────────────────

interface UQCardProps {
  q: UrgentQuestion
  userId: string | null
  onRefresh: () => void
}

function UQCard({ q, userId, onRefresh }: UQCardProps) {
  const [seconded, setSeconded] = useState(q.user_has_seconded)
  const [secondCount, setSecondCount] = useState(q.seconds_count)
  const [secondBusy, setSecondBusy] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showResponse, setShowResponse] = useState(false)
  const [showSupp, setShowSupp] = useState(false)
  const cfg = STATUS_CONFIG[q.status]

  async function toggleSecond() {
    if (secondBusy || !userId) return
    setSecondBusy(true)
    const wasSeconded = seconded
    setSeconded((s) => !s)
    setSecondCount((c) => wasSeconded ? Math.max(0, c - 1) : c + 1)
    try {
      await fetch('/api/urgent-questions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'second', question_id: q.id }),
      })
    } catch {
      setSeconded(wasSeconded)
      setSecondCount(q.seconds_count)
    } finally {
      setSecondBusy(false)
    }
  }

  const isAddressed = userId === q.addressed_to?.id
  const canRespond = !!userId && q.status !== 'expired'
  const hasResponses = q.responses.length > 0
  const hasSupps = q.supplementaries.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-5 transition-colors',
        q.status === 'certified'
          ? 'bg-gold/5 border-gold/25 hover:border-gold/40'
          : q.status === 'answered'
          ? 'bg-emerald/5 border-emerald/20'
          : 'bg-surface-200/60 border-surface-300/40 hover:border-surface-400/50',
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <Link href={`/profile/${q.author.username}`} className="flex-shrink-0">
          <Avatar src={q.author.avatar_url} fallback={q.author.display_name || q.author.username} size="sm" />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <Link href={`/profile/${q.author.username}`} className="text-xs font-mono font-semibold text-white hover:text-for-400 transition-colors">
              {q.author.display_name || q.author.username}
            </Link>
            <span className="text-[11px] text-surface-600 font-mono">{relativeTime(q.created_at)}</span>
            <span className={cn('text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border', cfg.bg, cfg.color)}>
              {cfg.label}
            </span>
          </div>

          {q.addressed_to && (
            <div className="flex items-center gap-1 text-[11px] text-surface-500 font-mono">
              <span>To</span>
              <Link href={`/profile/${q.addressed_to.username}`} className="text-for-400 hover:text-for-300 transition-colors flex items-center gap-1">
                <Avatar src={q.addressed_to.avatar_url} fallback={q.addressed_to.username} size="xs" />
                {q.addressed_to.display_name || q.addressed_to.username}
              </Link>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 text-right">
          <div className="flex items-center gap-1 text-xs text-surface-500 font-mono">
            <Clock className="h-3 w-3" />
            {timeUntil(q.expires_at)}
          </div>
        </div>
      </div>

      {/* Question text */}
      <p className="text-sm text-white/90 leading-relaxed mb-3 font-medium">
        {q.question_text}
      </p>

      {/* Context note */}
      {q.context_note && (
        <p className="text-xs text-surface-500 italic mb-3 pl-3 border-l-2 border-surface-400/40">
          {q.context_note}
        </p>
      )}

      {/* Topic link */}
      {q.topic_statement && q.topic_id && (
        <Link
          href={`/topic/${q.topic_id}`}
          className="inline-flex items-center gap-1.5 text-xs text-for-400 hover:text-for-300 bg-for-500/10 border border-for-500/20 rounded-lg px-3 py-1.5 mb-3 transition-colors"
        >
          <Scale className="h-3 w-3" />
          <span className="truncate max-w-[200px]">{q.topic_statement}</span>
          <ExternalLink className="h-3 w-3 flex-shrink-0" />
        </Link>
      )}

      {/* Actions bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Second button */}
        <button
          onClick={toggleSecond}
          disabled={secondBusy || !userId || userId === q.author.id}
          aria-label={seconded ? 'Remove second' : 'Second this question'}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            seconded
              ? 'bg-gold/20 border-gold/40 text-gold'
              : 'bg-surface-300/40 border-surface-400/30 text-surface-500 hover:border-gold/30 hover:text-gold hover:bg-gold/10',
          )}
        >
          {secondBusy
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <CheckCircle2 className="h-3 w-3" />
          }
          <span>{seconded ? 'Seconded' : 'Second'}</span>
          <span className={cn(
            'ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold',
            secondCount >= 5 ? 'bg-gold/30 text-gold' : 'bg-surface-300/50 text-surface-500'
          )}>
            {secondCount}
          </span>
        </button>

        {/* Expand / collapse responses */}
        {(hasResponses || hasSupps) && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-500 hover:text-white border border-surface-400/30 hover:border-surface-500/50 bg-surface-300/30 transition-all"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {hasResponses ? `${q.responses.length} response${q.responses.length !== 1 ? 's' : ''}` : ''}
            {hasResponses && hasSupps ? ' · ' : ''}
            {hasSupps ? `${q.supplementaries.length} supplementary` : ''}
          </button>
        )}

        {/* Respond / supplementary buttons */}
        {canRespond && !showResponse && !showSupp && (
          <>
            {isAddressed && (
              <button
                onClick={() => setShowResponse(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-emerald bg-emerald/10 border border-emerald/30 hover:bg-emerald/20 transition-all"
              >
                <Shield className="h-3 w-3" />
                Respond (official)
              </button>
            )}
            {!isAddressed && (
              <button
                onClick={() => { if (hasResponses) setShowSupp(true); else setShowResponse(true) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-500 hover:text-white border border-surface-400/30 hover:border-for-500/40 bg-surface-300/30 hover:bg-for-500/10 transition-all"
              >
                <MessageSquare className="h-3 w-3" />
                {hasResponses ? 'Ask supplementary' : 'Respond'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Responses */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3">
              {q.responses.map((r) => (
                <div key={r.id} className={cn(
                  'rounded-xl p-3 border',
                  r.is_official ? 'bg-emerald/5 border-emerald/20' : 'bg-surface-100/50 border-surface-300/30'
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar src={r.responder.avatar_url} fallback={r.responder.username} size="xs" />
                    <Link href={`/profile/${r.responder.username}`} className="text-xs font-mono font-semibold text-white hover:text-for-400 transition-colors">
                      {r.responder.display_name || r.responder.username}
                    </Link>
                    {r.is_official && (
                      <span className="text-[10px] font-mono font-bold text-emerald bg-emerald/15 border border-emerald/30 px-1.5 py-0.5 rounded-full">
                        Official
                      </span>
                    )}
                    <span className="text-[11px] text-surface-600 font-mono ml-auto">{relativeTime(r.created_at)}</span>
                  </div>
                  <p className="text-xs text-white/85 leading-relaxed">{r.response_text}</p>
                </div>
              ))}

              {q.supplementaries.map((s) => (
                <div key={s.id} className="rounded-xl p-3 bg-surface-100/30 border border-surface-300/20 pl-5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Avatar src={s.author.avatar_url} fallback={s.author.username} size="xs" />
                    <Link href={`/profile/${s.author.username}`} className="text-xs font-mono font-semibold text-white hover:text-for-400 transition-colors">
                      {s.author.display_name || s.author.username}
                    </Link>
                    <span className="text-[10px] font-mono text-surface-600 bg-surface-300/40 px-1.5 py-0.5 rounded-full border border-surface-400/20">
                      Supplementary
                    </span>
                    <span className="text-[11px] text-surface-600 font-mono ml-auto">{relativeTime(s.created_at)}</span>
                  </div>
                  <p className="text-xs text-surface-500 leading-relaxed">{s.supplementary}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inline forms */}
      <AnimatePresence>
        {showResponse && (
          <ResponseForm
            questionId={q.id}
            isOfficial={isAddressed}
            type="respond"
            onSubmit={() => { setShowResponse(false); onRefresh() }}
            onClose={() => setShowResponse(false)}
          />
        )}
        {showSupp && (
          <ResponseForm
            questionId={q.id}
            isOfficial={false}
            type="supplementary"
            onSubmit={() => { setShowSupp(false); onRefresh() }}
            onClose={() => setShowSupp(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Main Client ───────────────────────────────────────────────────────────────

export function UrgentQuestionsClient() {
  const [data, setData] = useState<UQListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<'all' | 'certified' | 'answered'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [uqRes, authRes] = await Promise.all([
        fetch('/api/urgent-questions'),
        fetch('/api/auth/me').catch(() => null),
      ])
      if (uqRes.ok) setData(await uqRes.json() as UQListResponse)
      if (authRes?.ok) {
        const auth = await authRes.json() as { id?: string }
        setUserId(auth.id ?? null)
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [])

  // Also get userId from Supabase client directly
  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setUserId(user.id)
      })
    })
    load()
  }, [load])

  const filtered = (data?.questions ?? []).filter((q) => {
    if (filter === 'certified') return q.status === 'certified'
    if (filter === 'answered') return q.status === 'answered'
    return true
  })

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28">

        {/* Page header */}
        <div className="flex items-start gap-3 mb-6">
          <Link href="/parliament" aria-label="Back to Parliament" className="mt-1 flex-shrink-0 text-surface-500 hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <Bell className="h-5 w-5 text-gold" />
              <h1 className="font-mono text-2xl font-bold text-white">Urgent Questions</h1>
            </div>
            <p className="text-sm font-mono text-surface-500">
              Demand immediate answers from civic ministers
            </p>
          </div>

          <Button
            onClick={() => setShowForm((v) => !v)}
            size="sm"
            disabled={data?.user_asked_today === true}
            title={data?.user_asked_today ? 'You have already tabled a question today' : 'Table an urgent question'}
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Cancel' : 'Table UQ'}
          </Button>
        </div>

        {/* How it works banner */}
        <div className="rounded-xl bg-gold/5 border border-gold/20 px-4 py-3 mb-6 text-xs font-mono text-surface-500 flex items-start gap-2">
          <Zap className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
          <span>
            Table a question on any urgent civic matter. Get{' '}
            <strong className="text-gold">5 seconds</strong> for it to become{' '}
            <strong className="text-gold">Certified Urgent</strong> and surface to the top of the chamber.
            Ministers and coalition leaders may respond.{' '}
            Questions expire after <strong className="text-gold">24 hours</strong>.
          </span>
        </div>

        {/* Submit form */}
        <AnimatePresence>
          {showForm && !data?.user_asked_today && (
            <SubmitForm
              onSubmit={() => { setShowForm(false); load() }}
              onClose={() => setShowForm(false)}
            />
          )}
        </AnimatePresence>

        {data?.user_asked_today && (
          <div className="flex items-center gap-2 text-xs font-mono text-surface-500 bg-surface-200/50 border border-surface-300/40 rounded-xl px-4 py-3 mb-6">
            <CheckCircle2 className="h-4 w-4 text-emerald" />
            You have already tabled a question today. You can table another after 24 hours.
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {([
            { key: 'all', label: 'All', icon: Users },
            { key: 'certified', label: 'Certified Urgent', icon: Zap },
            { key: 'answered', label: 'Answered', icon: CheckCircle2 },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                filter === key
                  ? 'bg-for-500/20 border-for-500/40 text-for-400'
                  : 'bg-surface-200/60 border-surface-300/40 text-surface-500 hover:text-white hover:border-surface-400/60',
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
              {key !== 'all' && (
                <span className="px-1.5 py-0.5 rounded-full bg-surface-300/50 text-[10px]">
                  {data?.questions.filter((q) => q.status === key).length ?? 0}
                </span>
              )}
            </button>
          ))}

          <button
            onClick={load}
            disabled={loading}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-500 hover:text-white border border-surface-400/30 bg-surface-200/40 transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Content */}
        {loading && !data ? (
          <UQSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No urgent questions"
            description={
              filter !== 'all'
                ? `No questions with status "${filter}" right now.`
                : 'No active urgent questions. Be the first to table one.'
            }
            action={
              userId && !data?.user_asked_today
                ? { label: 'Table a Question', onClick: () => setShowForm(true) }
                : undefined
            }
          />
        ) : (
          <div className="space-y-4">
            {filtered.map((q) => (
              <UQCard key={q.id} q={q} userId={userId} onRefresh={load} />
            ))}
          </div>
        )}

        {/* Links to other chambers */}
        <div className="mt-10 pt-6 border-t border-surface-300/30">
          <p className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3">Related chambers</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: '/oral-questions', label: 'Oral Questions', icon: MessageSquare },
              { href: '/written-questions', label: 'Written Questions', icon: Scale },
              { href: '/adjournment', label: 'Adjournment Debates', icon: Zap },
              { href: '/parliament', label: 'The Parliament', icon: Users },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-200/50 border border-surface-300/40 hover:border-surface-400/60 text-xs font-mono text-surface-500 hover:text-white transition-all"
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0 text-for-400" />
                {label}
              </Link>
            ))}
          </div>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
