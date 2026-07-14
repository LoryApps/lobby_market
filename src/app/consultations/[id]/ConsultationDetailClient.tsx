'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  Search,
  Send,
  Sparkles,
  ThumbsUp,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ConsultationDetail, ConsultationResponse } from '@/app/api/consultations/[id]/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const PAPER_TYPES: Record<string, { label: string; color: string; icon: typeof FileText }> = {
  green_paper:       { label: 'Green Paper',       color: 'text-emerald',     icon: FileText },
  white_paper:       { label: 'White Paper',       color: 'text-surface-300', icon: Scale },
  call_for_evidence: { label: 'Call for Evidence', color: 'text-purple',      icon: Search },
}

const STANCES: Array<{
  value: string
  label: string
  short: string
  color: string
  bgColor: string
  icon: typeof CheckCircle2
}> = [
  { value: 'strongly_support', label: 'Strongly Support', short: 'Strongly For',    color: 'text-for-300',    bgColor: 'bg-for-600/80',       icon: CheckCircle2 },
  { value: 'support',          label: 'Support',          short: 'For',             color: 'text-for-400',    bgColor: 'bg-for-500/70',       icon: CheckCircle2 },
  { value: 'neutral',          label: 'Neutral',          short: 'Neutral',         color: 'text-surface-400',bgColor: 'bg-surface-400/70',   icon: Scale },
  { value: 'oppose',           label: 'Oppose',           short: 'Against',         color: 'text-against-400',bgColor: 'bg-against-500/70',   icon: XCircle },
  { value: 'strongly_oppose',  label: 'Strongly Oppose',  short: 'Strongly Against',color: 'text-against-300',bgColor: 'bg-against-600/80',   icon: XCircle },
]

const STANCE_MAP = Object.fromEntries(STANCES.map((s) => [s.value, s]))

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-purple',
  Culture:     'text-gold',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-300',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function daysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return formatDate(iso)
}

// ─── Stance Bar ───────────────────────────────────────────────────────────────

function StanceBar({ breakdown, total }: { breakdown: Record<string, number>; total: number }) {
  if (total === 0) return null
  return (
    <div className="space-y-2">
      {STANCES.map(({ value, short, color, bgColor }) => {
        const count = breakdown[value] ?? 0
        const pct = total > 0 ? Math.round((count / total) * 100) : 0
        if (count === 0) return null
        return (
          <div key={value} className="flex items-center gap-3">
            <span className={cn('text-[11px] font-mono w-28 flex-shrink-0', color)}>{short}</span>
            <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
              <motion.div
                className={cn('h-full rounded-full', bgColor)}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ delay: 0.1, duration: 0.4 }}
              />
            </div>
            <span className="text-[11px] font-mono text-surface-500 w-14 text-right flex-shrink-0">
              {pct}% ({count})
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Response Card ────────────────────────────────────────────────────────────

function ResponseCard({
  response,
  onUpvote,
}: {
  response: ConsultationResponse
  onUpvote: (id: string, upvoted: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const stanceMeta = STANCE_MAP[response.stance]
  const isLong = response.response_text.length > 300

  return (
    <div
      className={cn(
        'p-4 rounded-xl bg-surface-100 border transition-colors',
        response.is_featured
          ? 'border-gold/30 bg-gold/5'
          : 'border-surface-300 hover:border-surface-400'
      )}
    >
      {response.is_featured && (
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-gold mb-3">
          <Award className="h-3 w-3" />
          Featured response
        </div>
      )}

      <div className="flex items-start gap-3">
        <Avatar
          src={response.author.avatar_url}
          fallback={response.author.display_name ?? response.author.username}
          size="sm"
          className="flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Link
              href={`/profile/${response.author.username}`}
              className="text-xs font-mono text-surface-300 hover:text-white transition-colors"
            >
              @{response.author.username}
            </Link>
            {stanceMeta && (
              <span className={cn('text-[11px] font-mono font-semibold', stanceMeta.color)}>
                {stanceMeta.label}
              </span>
            )}
            <span className="text-[11px] font-mono text-surface-600 ml-auto">
              {relativeTime(response.created_at)}
            </span>
          </div>

          <p className={cn('text-sm font-mono text-surface-200 leading-relaxed', !expanded && isLong && 'line-clamp-4')}>
            {response.response_text}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 mt-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}

          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={() => onUpvote(response.id, response.user_upvoted)}
              className={cn(
                'flex items-center gap-1 text-[11px] font-mono transition-colors',
                response.user_upvoted
                  ? 'text-for-400 hover:text-for-300'
                  : 'text-surface-500 hover:text-for-400'
              )}
            >
              <ThumbsUp className="h-3 w-3" />
              {response.upvotes}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Submit form ──────────────────────────────────────────────────────────────

function ResponseForm({
  consultationId,
  existingResponse,
  onSuccess,
  onDelete,
}: {
  consultationId: string
  existingResponse: ConsultationResponse | null
  onSuccess: (r: ConsultationResponse) => void
  onDelete: () => void
}) {
  const [stance, setStance] = useState(existingResponse?.stance ?? 'neutral')
  const [text, setText] = useState(existingResponse?.response_text ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const textRef = useRef<HTMLTextAreaElement>(null)

  const hasChanged =
    text !== (existingResponse?.response_text ?? '') ||
    stance !== (existingResponse?.stance ?? 'neutral')

  const canSubmit = text.trim().length >= 20 && hasChanged && !submitting

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch(`/api/consultations/${consultationId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response_text: text.trim(), stance }),
      })
      if (!res.ok) {
        const err = await res.json()
        setSubmitError(err.error ?? 'Failed to submit')
        return
      }
      const { response: saved } = await res.json()
      onSuccess(saved)
    } catch {
      setSubmitError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!existingResponse) return
    setDeleting(true)
    try {
      await fetch(`/api/consultations/${consultationId}/respond`, { method: 'DELETE' })
      onDelete()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="rounded-xl border border-for-500/20 bg-surface-100 p-5 space-y-4">
      <h3 className="font-mono text-sm font-semibold text-white flex items-center gap-2">
        <Send className="h-4 w-4 text-for-400" />
        {existingResponse ? 'Edit your response' : 'Submit your response'}
      </h3>

      {/* Stance selector */}
      <div>
        <p className="text-[11px] font-mono text-surface-500 mb-2">Your position on this consultation:</p>
        <div className="flex flex-wrap gap-2">
          {STANCES.map((s) => (
            <button
              key={s.value}
              onClick={() => setStance(s.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors',
                stance === s.value
                  ? cn('border-current font-semibold', s.color, 'bg-current/10')
                  : 'border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Text area */}
      <div>
        <textarea
          ref={textRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write your response here. Explain your views on the proposal, provide evidence or examples, and suggest any alternatives. Min 20 characters."
          rows={6}
          className={cn(
            'w-full rounded-lg bg-surface-200 border border-surface-300 px-4 py-3',
            'text-sm font-mono text-white placeholder:text-surface-600',
            'focus:outline-none focus:border-for-500/50 transition-colors resize-none'
          )}
        />
        <div className="flex items-center justify-between mt-1">
          <span className={cn(
            'text-[11px] font-mono',
            text.length < 20 ? 'text-against-400' : 'text-surface-600'
          )}>
            {text.length} / 5000 chars {text.length < 20 && `(${20 - text.length} more needed)`}
          </span>
        </div>
      </div>

      {submitError && (
        <p className="text-xs font-mono text-against-400">{submitError}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={!canSubmit}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono font-medium transition-colors',
            'bg-for-600 text-white hover:bg-for-500',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {submitting ? 'Submitting…' : existingResponse ? 'Update response' : 'Submit response'}
        </button>

        {existingResponse && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono text-against-400 hover:text-against-300 hover:bg-against-500/10 transition-colors disabled:opacity-50"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ConsultationDetailClient({ id }: { id: string }) {
  const [data, setData] = useState<ConsultationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/consultations/${id}`)
      if (!res.ok) throw new Error('Not found')
      const json = (await res.json()) as ConsultationDetail
      setData(json)
      setIsAuthenticated(!!json.user_response || false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  // Detect if user is logged in by checking cookie presence (simple heuristic)
  useEffect(() => {
    fetch('/api/me')
      .then((r) => { if (r.ok) setIsAuthenticated(true) })
      .catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  const handleUpvote = useCallback(async (responseId: string, currentlyUpvoted: boolean) => {
    if (!isAuthenticated) return
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        responses: prev.responses.map((r) =>
          r.id === responseId
            ? { ...r, user_upvoted: !currentlyUpvoted, upvotes: r.upvotes + (currentlyUpvoted ? -1 : 1) }
            : r
        ),
      }
    })
    const url = `/api/consultations/${id}/upvote?responseId=${encodeURIComponent(responseId)}`
    await fetch(url, { method: currentlyUpvoted ? 'DELETE' : 'POST' }).catch(() => {})
  }, [id, isAuthenticated])

  const handleResponseSuccess = useCallback((_saved: ConsultationResponse) => {
    setShowForm(false)
    load()
  }, [load])

  const handleResponseDelete = useCallback(() => {
    setShowForm(false)
    load()
  }, [load])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
          <Skeleton className="h-4 w-24 mb-6" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-48 rounded-xl" />
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
        <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
          <EmptyState icon={RefreshCw} title="Consultation not found" description="It may have been removed or the link is invalid." />
        </main>
        <BottomNav />
      </div>
    )
  }

  const typeMeta = PAPER_TYPES[data.paper_type] ?? PAPER_TYPES.green_paper
  const TypeIcon = typeMeta.icon
  const isOpen = data.status === 'open'
  const isPublished = data.status === 'published'
  const catColor = CATEGORY_COLORS[data.category] ?? 'text-surface-400'
  const days = isOpen ? daysLeft(data.closes_at) : 0
  const totalResponses = data.responses.length
  const featured = data.responses.filter((r) => r.is_featured)
  const others = data.responses.filter((r) => !r.is_featured)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Back link ────────────────────────────────────────────── */}
        <Link
          href="/consultations"
          className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white mb-6 transition-colors w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All consultations
        </Link>

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="mb-8">
          {/* Type + status badges */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className={cn('flex items-center gap-1 text-xs font-mono font-semibold', typeMeta.color)}>
              <TypeIcon className="h-3.5 w-3.5" />
              {typeMeta.label}
            </span>
            <span className={cn('text-xs font-mono', catColor)}>{data.category}</span>
            {isOpen && (
              <span className="text-[11px] font-mono text-emerald bg-emerald/10 px-2 py-0.5 rounded-full">
                OPEN FOR RESPONSES
              </span>
            )}
            {data.status === 'closed' && (
              <span className="text-[11px] font-mono text-surface-500 bg-surface-300/50 px-2 py-0.5 rounded-full">
                CLOSED
              </span>
            )}
            {isPublished && (
              <span className="text-[11px] font-mono text-for-400 bg-for-500/10 px-2 py-0.5 rounded-full">
                GOVERNMENT RESPONSE PUBLISHED
              </span>
            )}
          </div>

          <h1 className="font-mono text-2xl font-bold text-white leading-snug mb-3">
            {data.title}
          </h1>

          <p className="text-sm font-mono text-surface-400 leading-relaxed mb-5">
            {data.summary}
          </p>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-mono text-surface-500 pb-5 border-b border-surface-300">
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              {data.department}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {data.response_count} {data.response_count === 1 ? 'response' : 'responses'}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Opens {formatDate(data.opens_at)}
            </span>
            {isOpen ? (
              <span className={cn('flex items-center gap-1.5', days <= 7 ? 'text-against-400' : days <= 14 ? 'text-gold' : '')}>
                <Clock className="h-3.5 w-3.5" />
                {days === 0 ? 'Closes today' : `Closes ${formatDate(data.closes_at)} (${days} day${days !== 1 ? 's' : ''} left)`}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Closed {formatDate(data.closes_at)}
              </span>
            )}
          </div>
        </div>

        {/* ── Full text ────────────────────────────────────────────── */}
        {data.full_text && (
          <div className="mb-8 p-5 rounded-xl bg-surface-100 border border-surface-300">
            <h2 className="font-mono text-sm font-semibold text-surface-400 uppercase tracking-wider mb-4">
              Consultation Document
            </h2>
            <div className="prose prose-invert prose-sm max-w-none font-mono">
              <p className="text-sm text-surface-300 leading-relaxed whitespace-pre-wrap">{data.full_text}</p>
            </div>
          </div>
        )}

        {/* ── Government response ──────────────────────────────────── */}
        {isPublished && data.gov_response && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-5 rounded-xl bg-for-600/10 border border-for-500/25"
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-for-400" />
              <h2 className="font-mono text-sm font-semibold text-for-300">Government Response</h2>
            </div>
            <p className="text-sm font-mono text-surface-300 leading-relaxed">{data.gov_response}</p>
          </motion.div>
        )}

        {/* ── Stance breakdown ─────────────────────────────────────── */}
        {totalResponses > 0 && (
          <div className="mb-8 p-5 rounded-xl bg-surface-100 border border-surface-300">
            <h2 className="font-mono text-sm font-semibold text-surface-400 uppercase tracking-wider mb-4">
              Response Overview · {totalResponses} {totalResponses === 1 ? 'respondent' : 'respondents'}
            </h2>
            <StanceBar breakdown={data.stance_breakdown} total={totalResponses} />
          </div>
        )}

        {/* ── Submit / edit CTA ────────────────────────────────────── */}
        {isOpen && (
          <div className="mb-8">
            {isAuthenticated ? (
              <AnimatePresence mode="wait">
                {showForm || data.user_response ? (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    <ResponseForm
                      consultationId={id}
                      existingResponse={data.user_response}
                      onSuccess={handleResponseSuccess}
                      onDelete={handleResponseDelete}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="cta"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <button
                      onClick={() => setShowForm(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-for-500/25 bg-for-500/5 text-for-300 text-sm font-mono hover:bg-for-500/10 hover:border-for-500/40 transition-colors"
                    >
                      <Send className="h-4 w-4" />
                      Submit your response to this consultation
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            ) : (
              <div className="p-4 rounded-xl bg-surface-100 border border-surface-300 text-center">
                <p className="text-sm font-mono text-surface-400 mb-3">
                  Sign in to submit your response to this consultation.
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors"
                >
                  Sign in to respond
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── Responses ────────────────────────────────────────────── */}
        <div>
          <h2 className="font-mono text-sm font-semibold text-surface-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Public Responses
            <span className="text-surface-600">{totalResponses}</span>
          </h2>

          {data.responses.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No responses yet"
              description={isOpen ? 'Be the first to respond to this consultation.' : 'No public responses were submitted.'}
            />
          ) : (
            <div className="space-y-3">
              {featured.length > 0 && (
                <div className="space-y-3">
                  {featured.map((r) => (
                    <ResponseCard key={r.id} response={r} onUpvote={handleUpvote} />
                  ))}
                </div>
              )}
              {others.length > 0 && (
                <div className="space-y-3">
                  {others.map((r) => (
                    <ResponseCard key={r.id} response={r} onUpvote={handleUpvote} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
