'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ExternalLink,
  FileText,
  Gavel,
  Info,
  Loader2,
  MessageSquare,
  Mic2,
  RefreshCw,
  Send,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { TestimonyRow, HearingDetailResponse } from '@/app/api/hearings/[id]/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HearingProps {
  id: string
  topic_id: string | null
  topic_statement: string | null
  topic_category: string | null
  committee: string
  title: string
  description: string | null
  chair: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  status: 'open' | 'closed' | 'archived'
  recommendation: 'for' | 'against' | 'hold' | 'neutral' | null
  rationale: string | null
  testimony_count: number
  for_count: number
  against_count: number
  neutral_count: number
  created_at: string
  closed_at: string | null
}

interface HearingDetailClientProps {
  hearing: HearingProps
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COMMITTEE_COLORS: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  Economics:   { text: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30',          dot: 'bg-gold' },
  Politics:    { text: 'text-for-400',       bg: 'bg-for-500/10',       border: 'border-for-500/30',       dot: 'bg-for-500' },
  Technology:  { text: 'text-purple',        bg: 'bg-purple/10',        border: 'border-purple/30',        dot: 'bg-purple' },
  Science:     { text: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30',       dot: 'bg-emerald' },
  Ethics:      { text: 'text-against-400',   bg: 'bg-against-500/10',   border: 'border-against-500/30',   dot: 'bg-against-400' },
  Philosophy:  { text: 'text-purple',        bg: 'bg-purple/10',        border: 'border-purple/30',        dot: 'bg-purple' },
  Culture:     { text: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30',          dot: 'bg-gold' },
  Health:      { text: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30',       dot: 'bg-emerald' },
  Environment: { text: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30',       dot: 'bg-emerald' },
  Education:   { text: 'text-for-400',       bg: 'bg-for-500/10',       border: 'border-for-500/30',       dot: 'bg-for-500' },
}

function getCommitteeStyle(committee: string) {
  return COMMITTEE_COLORS[committee] ?? {
    text: 'text-surface-500',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
    dot: 'bg-surface-500',
  }
}

const RECOMMENDATION_CONFIG: Record<string, {
  label: string
  icon: typeof ThumbsUp
  bg: string
  border: string
  text: string
}> = {
  for:     { label: 'Recommends: FOR',     icon: ThumbsUp,   bg: 'bg-for-500/10',     border: 'border-for-500/40',     text: 'text-for-400' },
  against: { label: 'Recommends: AGAINST', icon: ThumbsDown, bg: 'bg-against-500/10', border: 'border-against-500/40', text: 'text-against-400' },
  hold:    { label: 'Recommends: HOLD',    icon: Gavel,      bg: 'bg-gold/10',         border: 'border-gold/40',         text: 'text-gold' },
  neutral: { label: 'No Recommendation',   icon: Info,       bg: 'bg-surface-300/40', border: 'border-surface-400/40', text: 'text-surface-500' },
}

const STANCE_CONFIG = {
  for:     { label: 'For',     bg: 'bg-for-500/15',     border: 'border-for-500/40',     text: 'text-for-400',     bar: 'bg-for-500' },
  against: { label: 'Against', bg: 'bg-against-500/15', border: 'border-against-500/40', text: 'text-against-400', bar: 'bg-against-500' },
  neutral: { label: 'Neutral', bg: 'bg-surface-300/40', border: 'border-surface-400/40', text: 'text-surface-400', bar: 'bg-surface-400' },
}

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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Stance Bar ───────────────────────────────────────────────────────────────

function StanceBar({ forCount, againstCount, neutralCount }: {
  forCount: number
  againstCount: number
  neutralCount: number
}) {
  const total = forCount + againstCount + neutralCount
  if (total === 0) return null
  const forPct = Math.round((forCount / total) * 100)
  const againstPct = Math.round((againstCount / total) * 100)
  const neutralPct = 100 - forPct - againstPct

  return (
    <div className="space-y-2">
      <div className="flex h-2 rounded-full overflow-hidden gap-px">
        {forPct > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${forPct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="bg-for-500 rounded-l-full"
          />
        )}
        {neutralPct > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${neutralPct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            className="bg-surface-400"
          />
        )}
        {againstPct > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${againstPct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
            className="bg-against-500 rounded-r-full"
          />
        )}
      </div>
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-for-400">{forCount} for</span>
        <span className="text-surface-500">{neutralCount} neutral</span>
        <span className="text-against-400">{againstCount} against</span>
      </div>
    </div>
  )
}

// ─── Testimony Card ───────────────────────────────────────────────────────────

function TestimonyCard({
  testimony,
  isOwn,
  onEdit,
  onWithdraw,
}: {
  testimony: TestimonyRow
  isOwn: boolean
  onEdit: () => void
  onWithdraw: () => void
}) {
  const stance = STANCE_CONFIG[testimony.stance as 'for' | 'against' | 'neutral']
  const author = testimony.author

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-4 space-y-3',
        isOwn ? 'border-for-500/30 bg-for-500/5' : 'border-surface-300 bg-surface-100'
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar
          src={author?.avatar_url ?? null}
          username={author?.username ?? 'anon'}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {author ? (
              <Link
                href={`/profile/${author.username}`}
                className="text-sm font-semibold text-white hover:text-for-400 transition-colors truncate"
              >
                {author.display_name ?? author.username}
              </Link>
            ) : (
              <span className="text-sm font-semibold text-surface-500">Anonymous</span>
            )}
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-semibold border',
                stance.bg, stance.border, stance.text
              )}
            >
              {stance.label}
            </span>
            {isOwn && (
              <span className="text-xs font-mono text-surface-600">Your testimony</span>
            )}
          </div>
          <p className="text-xs text-surface-500 mt-0.5">{relativeTime(testimony.created_at)}</p>
        </div>
        {isOwn && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={onEdit}
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors px-2 py-1 rounded hover:bg-surface-200"
            >
              Edit
            </button>
            <button
              onClick={onWithdraw}
              className="text-xs font-mono text-surface-600 hover:text-against-400 transition-colors px-2 py-1 rounded hover:bg-surface-200"
            >
              Withdraw
            </button>
          </div>
        )}
      </div>
      <p className="text-sm text-surface-300 leading-relaxed">{testimony.content}</p>
      {testimony.upvotes > 0 && (
        <p className="text-xs text-surface-600 font-mono">{testimony.upvotes} endorsement{testimony.upvotes !== 1 ? 's' : ''}</p>
      )}
    </motion.div>
  )
}

// ─── Testimony Form ───────────────────────────────────────────────────────────

function TestimonyForm({
  hearingId,
  existing,
  onSuccess,
  onCancel,
}: {
  hearingId: string
  existing: { id: string; stance: string; content: string } | null
  onSuccess: (testimony: TestimonyRow, action: 'created' | 'updated') => void
  onCancel: () => void
}) {
  const [stance, setStance] = useState<'for' | 'against' | 'neutral'>(
    (existing?.stance as 'for' | 'against' | 'neutral') ?? 'neutral'
  )
  const [content, setContent] = useState(existing?.content ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = content.trim()
    if (trimmed.length < 10) {
      setError('Testimony must be at least 10 characters.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/hearings/${hearingId}/testimony`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed, stance }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to submit testimony.')
        return
      }
      onSuccess(data.testimony as TestimonyRow, data.action as 'created' | 'updated')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const remaining = 500 - content.length
  const stances: Array<'for' | 'against' | 'neutral'> = ['for', 'against', 'neutral']

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Stance selector */}
      <div>
        <p className="text-xs font-mono text-surface-500 mb-2">Your stance</p>
        <div className="flex gap-2">
          {stances.map((s) => {
            const cfg = STANCE_CONFIG[s]
            const isSelected = stance === s
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStance(s)}
                className={cn(
                  'flex-1 py-2 rounded-lg border text-xs font-mono font-semibold transition-colors',
                  isSelected
                    ? `${cfg.bg} ${cfg.border} ${cfg.text}`
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400'
                )}
              >
                {cfg.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div>
        <p className="text-xs font-mono text-surface-500 mb-2">Your testimony</p>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, 500))}
          placeholder="State your position, evidence, and reasoning. Be concise and substantive."
          rows={5}
          className={cn(
            'w-full rounded-xl bg-surface-200 border text-sm text-white placeholder:text-surface-600',
            'px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-for-500/40',
            'transition-colors',
            error ? 'border-against-500/60' : 'border-surface-300 focus:border-surface-400'
          )}
        />
        <div className="flex items-center justify-between mt-1">
          {error ? (
            <p className="text-xs text-against-400">{error}</p>
          ) : (
            <span />
          )}
          <p className={cn('text-xs font-mono', remaining < 50 ? 'text-against-400' : 'text-surface-600')}>
            {remaining} remaining
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          variant="for"
          size="sm"
          disabled={submitting || content.trim().length < 10}
          className="flex-1"
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          {existing ? 'Update testimony' : 'Submit testimony'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TestimonySkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="flex gap-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3.5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function HearingDetailClient({ hearing }: HearingDetailClientProps) {
  const [testimonies, setTestimonies] = useState<TestimonyRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stanceFilter, setStanceFilter] = useState<'all' | 'for' | 'against' | 'neutral'>('all')
  const [showForm, setShowForm] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userTestimony, setUserTestimony] = useState<TestimonyRow | null>(null)
  const [withdrawing, setWithdrawing] = useState(false)
  const PAGE_SIZE = 20

  // Auth
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
    })
  }, [])

  const fetchTestimonies = useCallback(async (offset = 0, append = false) => {
    if (offset === 0) setLoading(true)
    else setLoadingMore(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      })
      if (stanceFilter !== 'all') params.set('stance', stanceFilter)
      const res = await fetch(`/api/hearings/${hearing.id}?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data: HearingDetailResponse = await res.json()
      setTestimonies((prev) => append ? [...prev, ...data.testimonies] : data.testimonies)
      setTotal(data.total)
      // Find user's own testimony
      if (userId && !append) {
        const own = data.testimonies.find((t) => t.user_id === userId) ?? null
        setUserTestimony(own)
      }
    } catch {
      setError('Unable to load testimonies.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [hearing.id, stanceFilter, userId])

  useEffect(() => {
    fetchTestimonies()
  }, [fetchTestimonies])

  function handleTestimonySuccess(testimony: TestimonyRow, action: 'created' | 'updated') {
    setShowForm(false)
    if (action === 'created') {
      setTestimonies((prev) => [testimony, ...prev])
      setTotal((t) => t + 1)
    } else {
      setTestimonies((prev) => prev.map((t) => t.id === testimony.id ? testimony : t))
    }
    setUserTestimony(testimony)
  }

  async function handleWithdraw() {
    if (!userTestimony) return
    setWithdrawing(true)
    try {
      const res = await fetch(`/api/hearings/${hearing.id}/testimony`, { method: 'DELETE' })
      if (res.ok) {
        setTestimonies((prev) => prev.filter((t) => t.id !== userTestimony.id))
        setTotal((t) => Math.max(0, t - 1))
        setUserTestimony(null)
      }
    } catch {
      // silent
    } finally {
      setWithdrawing(false)
    }
  }

  const committeeStyle = getCommitteeStyle(hearing.committee)
  const recConfig = hearing.recommendation ? RECOMMENDATION_CONFIG[hearing.recommendation] : null

  const canTestify = hearing.status === 'open' && !!userId
  const hasTestified = !!userTestimony

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-8 pb-24 md:pb-12 space-y-6">

        {/* ── Back nav ── */}
        <Link
          href="/hearings"
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors font-mono"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Committee Hearings
        </Link>

        {/* ── Hearing header ── */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6 space-y-5">
          {/* Committee + status */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono font-semibold',
                committeeStyle.bg, committeeStyle.border, committeeStyle.text
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', committeeStyle.dot)} />
              {hearing.committee} Committee
            </span>
            <span
              className={cn(
                'inline-flex items-center px-3 py-1 rounded-full border text-xs font-mono font-semibold',
                hearing.status === 'open'
                  ? 'bg-emerald/10 border-emerald/40 text-emerald'
                  : 'bg-surface-300/40 border-surface-400/40 text-surface-500'
              )}
            >
              {hearing.status === 'open' ? 'Open' : hearing.status === 'closed' ? 'Closed' : 'Archived'}
            </span>
          </div>

          {/* Title */}
          <div>
            <h1 className="font-mono text-xl font-bold text-white leading-snug">
              {hearing.title}
            </h1>
            {hearing.description && (
              <p className="text-sm text-surface-400 mt-2 leading-relaxed">
                {hearing.description}
              </p>
            )}
          </div>

          {/* Related topic */}
          {hearing.topic_id && hearing.topic_statement && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-200 border border-surface-300">
              <FileText className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-surface-500 mb-1">Related topic</p>
                <Link
                  href={`/topic/${hearing.topic_id}`}
                  className="text-sm text-white hover:text-for-400 transition-colors font-medium leading-snug flex items-start gap-1"
                >
                  {hearing.topic_statement}
                  <ExternalLink className="h-3 w-3 flex-shrink-0 mt-0.5 opacity-50" />
                </Link>
                {hearing.topic_category && (
                  <p className="text-xs text-surface-600 mt-0.5">{hearing.topic_category}</p>
                )}
              </div>
            </div>
          )}

          {/* Chair */}
          {hearing.chair && (
            <div className="flex items-center gap-3">
              <Avatar
                src={hearing.chair.avatar_url}
                username={hearing.chair.username}
                size="sm"
              />
              <div>
                <p className="text-xs font-mono text-surface-500">Committee Chair</p>
                <Link
                  href={`/profile/${hearing.chair.username}`}
                  className="text-sm font-semibold text-white hover:text-for-400 transition-colors"
                >
                  {hearing.chair.display_name ?? hearing.chair.username}
                </Link>
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center gap-4 text-xs font-mono text-surface-500 border-t border-surface-300 pt-4">
            <span>Opened {relativeTime(hearing.created_at)}</span>
            {hearing.closed_at && (
              <span>Closed {relativeTime(hearing.closed_at)}</span>
            )}
            <span>{hearing.testimony_count} {hearing.testimony_count === 1 ? 'testimony' : 'testimonies'}</span>
          </div>

          {/* Stance bar */}
          {(hearing.for_count + hearing.against_count + hearing.neutral_count) > 0 && (
            <StanceBar
              forCount={hearing.for_count}
              againstCount={hearing.against_count}
              neutralCount={hearing.neutral_count}
            />
          )}
        </div>

        {/* ── Committee recommendation ── */}
        <AnimatePresence>
          {recConfig && (hearing.status === 'closed' || hearing.status === 'archived') && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'rounded-2xl border p-5 space-y-3',
                recConfig.bg, recConfig.border
              )}
            >
              <div className="flex items-center gap-2">
                <recConfig.icon className={cn('h-5 w-5', recConfig.text)} />
                <p className={cn('font-mono text-sm font-bold', recConfig.text)}>
                  {recConfig.label}
                </p>
              </div>
              {hearing.rationale && (
                <p className="text-sm text-surface-300 leading-relaxed">
                  {hearing.rationale}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Testimonies section ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-mono text-sm font-bold text-white flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-surface-500" />
              Testimonies
              {total > 0 && (
                <span className="text-surface-500 font-normal">({total})</span>
              )}
            </h2>
            <button
              onClick={() => fetchTestimonies()}
              disabled={loading}
              aria-label="Refresh testimonies"
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Stance filter */}
          <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filter by stance">
            {(['all', 'for', 'against', 'neutral'] as const).map((s) => {
              const isActive = stanceFilter === s
              const count = s === 'for' ? hearing.for_count : s === 'against' ? hearing.against_count : s === 'neutral' ? hearing.neutral_count : total
              const cfg = s !== 'all' ? STANCE_CONFIG[s] : null
              return (
                <button
                  key={s}
                  onClick={() => setStanceFilter(s)}
                  aria-pressed={isActive}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-colors',
                    isActive && cfg
                      ? `${cfg.bg} ${cfg.border} ${cfg.text}`
                      : isActive
                      ? 'bg-surface-300 border-surface-400 text-white'
                      : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-300'
                  )}
                >
                  {s === 'all' ? 'All' : STANCE_CONFIG[s].label}
                  {count > 0 && (
                    <span className="opacity-60">{count}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Submit testimony CTA */}
          {canTestify && !showForm && (
            <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
              {hasTestified ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald" />
                    <span className="text-sm text-surface-400">
                      You submitted testimony as{' '}
                      <span className={cn(
                        'font-semibold',
                        userTestimony!.stance === 'for' ? 'text-for-400' :
                        userTestimony!.stance === 'against' ? 'text-against-400' :
                        'text-surface-400'
                      )}>
                        {userTestimony!.stance}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowForm(true)}
                      className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={handleWithdraw}
                      disabled={withdrawing}
                      className="text-xs font-mono text-surface-600 hover:text-against-400 transition-colors"
                    >
                      {withdrawing ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Withdraw'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-surface-400">
                    <Mic2 className="h-4 w-4 text-surface-500" />
                    This hearing is accepting testimony
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowForm(true)}
                  >
                    Submit testimony
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Testimony form */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-surface-300 bg-surface-100 p-5">
                  <p className="text-sm font-mono font-bold text-white mb-4">
                    {hasTestified ? 'Edit your testimony' : 'Submit testimony'}
                  </p>
                  <TestimonyForm
                    hearingId={hearing.id}
                    existing={userTestimony ? {
                      id: userTestimony.id,
                      stance: userTestimony.stance,
                      content: userTestimony.content,
                    } : null}
                    onSuccess={handleTestimonySuccess}
                    onCancel={() => setShowForm(false)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sign-in prompt */}
          {!userId && hearing.status === 'open' && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-surface-300 bg-surface-100 p-4">
              <p className="text-sm text-surface-500">Sign in to submit testimony</p>
              <Link href="/login">
                <Button variant="secondary" size="sm">Sign in</Button>
              </Link>
            </div>
          )}

          {/* Testimony list */}
          {loading ? (
            <TestimonySkeleton />
          ) : error ? (
            <div className="text-center py-10 space-y-3">
              <AlertCircle className="h-8 w-8 text-surface-500 mx-auto" />
              <p className="text-sm text-surface-500">{error}</p>
              <Button variant="secondary" size="sm" onClick={() => fetchTestimonies()}>
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          ) : testimonies.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No testimonies yet"
              description={
                hearing.status === 'open'
                  ? 'Be the first to submit testimony to this committee hearing.'
                  : 'No testimony was submitted for this hearing.'
              }
              action={
                canTestify && !hasTestified && !showForm
                  ? { label: 'Submit testimony', onClick: () => setShowForm(true) }
                  : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              {testimonies.map((testimony) => (
                <TestimonyCard
                  key={testimony.id}
                  testimony={testimony}
                  isOwn={testimony.user_id === userId}
                  onEdit={() => setShowForm(true)}
                  onWithdraw={handleWithdraw}
                />
              ))}

              {testimonies.length < total && (
                <button
                  onClick={() => fetchTestimonies(testimonies.length, true)}
                  disabled={loadingMore}
                  className="w-full py-3 rounded-xl border border-surface-300 text-sm font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : (
                    `Load more (${total - testimonies.length} remaining)`
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Footer nav ── */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 px-6 py-5 mt-6">
          <p className="text-xs font-mono text-surface-500 mb-3 text-center">
            Related civic institutions
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {[
              { href: '/hearings', label: 'All Hearings' },
              { href: '/assembly', label: "Citizens' Assembly" },
              { href: '/senate', label: 'The Senate' },
              { href: '/tribunal', label: 'Tribunal' },
              { href: '/grand-council', label: 'Grand Council' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
              >
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
