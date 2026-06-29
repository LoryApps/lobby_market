'use client'

/**
 * /hearings — Civic Committee Hearings
 *
 * Formal pre-vote testimony sessions. Before a contested topic goes to a
 * community vote, citizens can submit written evidence to the relevant
 * committee (Economics, Technology, Science, etc.).  The committee chair
 * reviews all testimonies and issues a formal recommendation (For / Against /
 * Hold / Neutral) that is shown on the topic page.
 *
 * Distinct from:
 *   /assembly      — random sortition, multi-round deliberation
 *   /debates       — live, adversarial, timed events
 *   /tribunal      — argument quality / moderation
 *   /topic         — free-form argument threads
 *
 * The hearing is evidence-first, structured, and recorded.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
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
  Users,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { HearingRow, HearingsResponse } from '@/app/api/hearings/route'
import type { TestimonyRow, HearingDetailResponse } from '@/app/api/hearings/[id]/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const COMMITTEES = [
  'All',
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

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
    bg: 'bg-surface-300/40',
    border: 'border-surface-400/40',
    dot: 'bg-surface-500',
  }
}

const RECOMMENDATION_CONFIG = {
  for: {
    label: 'Recommends: FOR',
    icon: ThumbsUp,
    classes: 'bg-for-500/15 border-for-500/40 text-for-400',
  },
  against: {
    label: 'Recommends: AGAINST',
    icon: ThumbsDown,
    classes: 'bg-against-500/15 border-against-500/40 text-against-400',
  },
  hold: {
    label: 'Recommends: HOLD',
    icon: Gavel,
    classes: 'bg-gold/15 border-gold/40 text-gold',
  },
  neutral: {
    label: 'No recommendation',
    icon: Info,
    classes: 'bg-surface-300/40 border-surface-400/40 text-surface-500',
  },
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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Stance bar ───────────────────────────────────────────────────────────────

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
    <div className="space-y-1.5">
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
        {forPct > 0 && (
          <div className="bg-for-500 rounded-l-full" style={{ width: `${forPct}%` }} />
        )}
        {neutralPct > 0 && (
          <div className="bg-surface-400" style={{ width: `${neutralPct}%` }} />
        )}
        {againstPct > 0 && (
          <div className="bg-against-500 rounded-r-full" style={{ width: `${againstPct}%` }} />
        )}
      </div>
      <div className="flex items-center gap-3 text-[10px] font-mono">
        <span className="text-for-400">{forPct}% For</span>
        {neutralPct > 0 && <span className="text-surface-500">{neutralPct}% Neutral</span>}
        <span className="text-against-400">{againstPct}% Against</span>
        <span className="text-surface-600 ml-auto">{total} testimonies</span>
      </div>
    </div>
  )
}

// ─── Testimony card ───────────────────────────────────────────────────────────

function TestimonyCard({ testimony }: { testimony: TestimonyRow }) {
  const isFor = testimony.stance === 'for'
  const isAgainst = testimony.stance === 'against'

  return (
    <div className={cn(
      'p-3.5 rounded-xl border text-sm',
      isFor ? 'bg-for-500/5 border-for-500/20' :
      isAgainst ? 'bg-against-500/5 border-against-500/20' :
      'bg-surface-200/50 border-surface-300'
    )}>
      <div className="flex items-center gap-2 mb-2">
        {testimony.author && (
          <Avatar
            src={testimony.author.avatar_url}
            fallback={testimony.author.display_name || testimony.author.username}
            size="xs"
          />
        )}
        <Link
          href={testimony.author ? `/profile/${testimony.author.username}` : '#'}
          className="text-xs font-medium text-surface-600 hover:text-white transition-colors"
        >
          {testimony.author?.display_name || testimony.author?.username || 'Anonymous'}
        </Link>
        <span className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold border',
          isFor ? 'bg-for-500/15 border-for-500/30 text-for-400' :
          isAgainst ? 'bg-against-500/15 border-against-500/30 text-against-400' :
          'bg-surface-300 border-surface-400 text-surface-500'
        )}>
          {isFor ? <ThumbsUp className="h-2.5 w-2.5" /> : isAgainst ? <ThumbsDown className="h-2.5 w-2.5" /> : <Info className="h-2.5 w-2.5" />}
          {testimony.stance.toUpperCase()}
        </span>
        <span className="ml-auto text-[10px] font-mono text-surface-600">
          {relativeTime(testimony.created_at)}
        </span>
      </div>
      <p className={cn(
        'text-xs leading-relaxed',
        isFor ? 'text-for-200' : isAgainst ? 'text-against-200' : 'text-surface-500'
      )}>
        {testimony.content}
      </p>
    </div>
  )
}

// ─── Testimony form ───────────────────────────────────────────────────────────

function TestimonyForm({
  hearingId,
  existing,
  onSuccess,
}: {
  hearingId: string
  existing: HearingRow['user_testimony']
  onSuccess: (t: HearingRow['user_testimony']) => void
}) {
  const [stance, setStance] = useState<'for' | 'against' | 'neutral'>(
    (existing?.stance as 'for' | 'against' | 'neutral') ?? 'neutral'
  )
  const [content, setContent] = useState(existing?.content ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/hearings/${hearingId}/testimony`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), stance }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to submit testimony')
        return
      }
      onSuccess({
        id: data.testimony.id,
        stance: data.testimony.stance,
        content: data.testimony.content,
        created_at: data.testimony.created_at,
      })
    } catch {
      setError('Failed to submit testimony. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const remaining = 500 - content.length

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-3 border-t border-surface-300">
      <p className="text-xs font-mono text-surface-500 flex items-center gap-1.5">
        <Mic2 className="h-3 w-3" />
        {existing ? 'Update your testimony' : 'Submit your testimony'}
      </p>

      {/* Stance selector */}
      <div className="flex gap-2" role="group" aria-label="Select your stance">
        {(['for', 'neutral', 'against'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStance(s)}
            aria-pressed={stance === s}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-mono font-semibold transition-colors',
              stance === s ? (
                s === 'for' ? 'bg-for-500/20 border-for-500/50 text-for-300' :
                s === 'against' ? 'bg-against-500/20 border-against-500/50 text-against-300' :
                'bg-surface-300 border-surface-400 text-white'
              ) : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-300'
            )}
          >
            {s === 'for' ? <ThumbsUp className="h-3 w-3" /> : s === 'against' ? <ThumbsDown className="h-3 w-3" /> : <Info className="h-3 w-3" />}
            {s.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Content textarea */}
      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="State your evidence, reasoning, or concern… (10–500 characters)"
          rows={4}
          maxLength={500}
          className={cn(
            'w-full resize-none rounded-xl px-3.5 py-3',
            'bg-surface-200 border border-surface-300',
            'text-sm text-white placeholder:text-surface-600',
            'focus:outline-none focus:border-for-500/50 focus:ring-1 focus:ring-for-500/20',
            'transition-colors'
          )}
        />
        <span className={cn(
          'absolute bottom-2.5 right-3 text-[10px] font-mono',
          remaining < 50 ? 'text-against-400' : 'text-surface-600'
        )}>
          {remaining}
        </span>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-against-400">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={submitting || content.trim().length < 10}
        size="sm"
        className="w-full"
      >
        {submitting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
        {existing ? 'Update testimony' : 'Submit testimony'}
      </Button>
    </form>
  )
}

// ─── Hearing card ─────────────────────────────────────────────────────────────

function HearingCard({ hearing: initialHearing }: { hearing: HearingRow }) {
  const [hearing, setHearing] = useState(initialHearing)
  const [expanded, setExpanded] = useState(false)
  const [testimonies, setTestimonies] = useState<TestimonyRow[]>([])
  const [loadingTestimonies, setLoadingTestimonies] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [stanceFilter, setStanceFilter] = useState<'all' | 'for' | 'against' | 'neutral'>('all')

  const committeeStyle = getCommitteeStyle(hearing.committee)
  const rec = hearing.recommendation ? RECOMMENDATION_CONFIG[hearing.recommendation] : null

  async function loadTestimonies() {
    if (loadingTestimonies) return
    setLoadingTestimonies(true)
    try {
      const params = new URLSearchParams({ limit: '10' })
      if (stanceFilter !== 'all') params.set('stance', stanceFilter)
      const res = await fetch(`/api/hearings/${hearing.id}?${params}`)
      if (res.ok) {
        const data: HearingDetailResponse = await res.json()
        setTestimonies(data.testimonies)
      }
    } catch {
      // best-effort
    } finally {
      setLoadingTestimonies(false)
    }
  }

  useEffect(() => {
    if (expanded) {
      loadTestimonies()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, stanceFilter])

  function handleTestimonySuccess(t: HearingRow['user_testimony']) {
    setHearing((prev) => ({
      ...prev,
      user_testimony: t,
      testimony_count: prev.user_testimony ? prev.testimony_count : prev.testimony_count + 1,
    }))
    setShowForm(false)
    if (expanded) loadTestimonies()
  }

  return (
    <motion.div
      layout
      className={cn(
        'rounded-2xl border transition-colors',
        hearing.status === 'open'
          ? 'bg-surface-100 border-surface-300 hover:border-surface-400'
          : 'bg-surface-100/60 border-surface-300/60'
      )}
    >
      {/* ── Header ── */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left p-5"
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-3">
          {/* Committee icon */}
          <div className={cn(
            'flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl border',
            committeeStyle.bg, committeeStyle.border
          )}>
            <Gavel className={cn('h-4 w-4', committeeStyle.text)} />
          </div>

          <div className="flex-1 min-w-0">
            {/* Committee + status badges */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
                committeeStyle.bg, committeeStyle.border, committeeStyle.text
              )}>
                <span className={cn('h-1.5 w-1.5 rounded-full', committeeStyle.dot)} />
                {hearing.committee} Committee
              </span>
              {hearing.status === 'open' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald/10 border border-emerald/30 text-emerald">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse" />
                  OPEN
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-surface-300/40 border border-surface-400/40 text-surface-500">
                  CLOSED
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="text-sm font-semibold text-white leading-snug mb-1">
              {hearing.title}
            </h3>

            {/* Linked topic */}
            {hearing.topic_statement && (
              <p className="text-xs text-surface-500 line-clamp-1 mb-2">
                <span className="text-surface-600">Re:</span>{' '}
                {hearing.topic_statement}
              </p>
            )}

            {/* Stats row */}
            <div className="flex items-center gap-3 text-xs text-surface-500">
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {hearing.testimony_count} {hearing.testimony_count === 1 ? 'testimony' : 'testimonies'}
              </span>
              {hearing.chair && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Chair: {hearing.chair.display_name || hearing.chair.username}
                </span>
              )}
              <span className="ml-auto text-[10px] font-mono text-surface-600">
                {relativeTime(hearing.created_at)}
              </span>
            </div>
          </div>

          {/* Expand arrow */}
          <div className="flex-shrink-0 text-surface-500 mt-1">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>

        {/* Stance bar (always visible if has data) */}
        {(hearing.for_count + hearing.against_count + hearing.neutral_count > 0) && (
          <div className="mt-3 px-0">
            <StanceBar
              forCount={hearing.for_count}
              againstCount={hearing.against_count}
              neutralCount={hearing.neutral_count}
            />
          </div>
        )}

        {/* Recommendation (closed hearings) */}
        {rec && (
          <div className={cn(
            'mt-3 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-mono font-semibold',
            rec.classes
          )}>
            <rec.icon className="h-3.5 w-3.5 flex-shrink-0" />
            {rec.label}
          </div>
        )}
      </button>

      {/* ── Expanded content ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4">
              {/* Description */}
              {hearing.description && (
                <p className="text-xs text-surface-500 leading-relaxed border-t border-surface-300 pt-4">
                  {hearing.description}
                </p>
              )}

              {/* Rationale (closed) */}
              {hearing.rationale && (
                <div className="flex items-start gap-2 px-3 py-3 rounded-xl bg-surface-200 border border-surface-300">
                  <BookOpen className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-mono text-surface-500 mb-1">Committee Rationale</p>
                    <p className="text-xs text-surface-400 leading-relaxed">{hearing.rationale}</p>
                  </div>
                </div>
              )}

              {/* Topic link */}
              {hearing.topic_id && (
                <Link
                  href={`/topic/${hearing.topic_id}`}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors group"
                >
                  <FileText className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
                  <span className="text-xs text-surface-500 group-hover:text-white transition-colors line-clamp-1">
                    {hearing.topic_statement}
                  </span>
                </Link>
              )}

              {/* Stance filter */}
              {hearing.testimony_count > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(['all', 'for', 'neutral', 'against'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStanceFilter(s)}
                      aria-pressed={stanceFilter === s}
                      className={cn(
                        'px-2.5 py-1 rounded-lg border text-[10px] font-mono font-semibold transition-colors',
                        stanceFilter === s ? (
                          s === 'for' ? 'bg-for-500/15 border-for-500/40 text-for-400' :
                          s === 'against' ? 'bg-against-500/15 border-against-500/40 text-against-400' :
                          s === 'neutral' ? 'bg-surface-300 border-surface-400 text-surface-600' :
                          'bg-surface-300 border-surface-400 text-white'
                        ) : 'bg-surface-200 border-surface-300 text-surface-600 hover:text-surface-400 hover:border-surface-400'
                      )}
                    >
                      {s === 'all' ? 'All' : s.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}

              {/* Testimonies list */}
              {loadingTestimonies ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
                </div>
              ) : testimonies.length > 0 ? (
                <div className="space-y-2">
                  {testimonies.map((t) => (
                    <TestimonyCard key={t.id} testimony={t} />
                  ))}
                </div>
              ) : hearing.testimony_count === 0 ? (
                <p className="text-xs text-surface-600 text-center py-4">
                  No testimonies yet. Be the first to submit evidence.
                </p>
              ) : null}

              {/* Your testimony status / form toggle */}
              {hearing.status === 'open' && (
                <div className="border-t border-surface-300 pt-3">
                  {hearing.user_testimony && !showForm ? (
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-200 border border-surface-300">
                      <Check className="h-4 w-4 text-emerald flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-emerald font-semibold mb-1">Your testimony is on record</p>
                        <p className="text-xs text-surface-500 line-clamp-2">{hearing.user_testimony.content}</p>
                        <span className={cn(
                          'inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold border',
                          hearing.user_testimony.stance === 'for' ? 'bg-for-500/15 border-for-500/30 text-for-400' :
                          hearing.user_testimony.stance === 'against' ? 'bg-against-500/15 border-against-500/30 text-against-400' :
                          'bg-surface-300 border-surface-400 text-surface-500'
                        )}>
                          {hearing.user_testimony.stance.toUpperCase()}
                        </span>
                      </div>
                      <button
                        onClick={() => setShowForm(true)}
                        className="flex-shrink-0 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  ) : (
                    <>
                      {!showForm ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full"
                          onClick={() => setShowForm(true)}
                        >
                          <Mic2 className="h-3.5 w-3.5" />
                          Submit testimony
                        </Button>
                      ) : (
                        <div>
                          <button
                            onClick={() => setShowForm(false)}
                            className="flex items-center gap-1 text-xs text-surface-500 hover:text-white transition-colors mb-3"
                          >
                            <X className="h-3 w-3" />
                            Cancel
                          </button>
                          <TestimonyForm
                            hearingId={hearing.id}
                            existing={hearing.user_testimony}
                            onSuccess={handleTestimonySuccess}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Page skeleton ────────────────────────────────────────────────────────────

function HearingsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
          <div className="flex items-start gap-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-28 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function HearingsClient() {
  const [hearings, setHearings] = useState<HearingRow[]>([])
  const [total, setTotal] = useState(0)
  const [openCount, setOpenCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [committeeFilter, setCommitteeFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState<'open' | 'closed' | 'all'>('open')

  const fetchHearings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        limit: '20',
      })
      if (committeeFilter !== 'All') params.set('committee', committeeFilter)
      const res = await fetch(`/api/hearings?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data: HearingsResponse = await res.json()
      setHearings(data.hearings)
      setTotal(data.total)
      setOpenCount(data.open_count)
    } catch {
      setError('Unable to load hearings. The committee system may not be set up yet.')
    } finally {
      setLoading(false)
    }
  }, [committeeFilter, statusFilter])

  useEffect(() => {
    fetchHearings()
  }, [fetchHearings])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-8 pb-24 md:pb-12">

        {/* ── Page header ── */}
        <div className="flex items-start gap-4 mb-6">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
            <Gavel className="h-5 w-5 text-gold" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white">
              Committee Hearings
            </h1>
            <p className="text-sm text-surface-500 mt-0.5">
              Formal testimony sessions before civic topics go to a vote
            </p>
          </div>
          <button
            onClick={fetchHearings}
            disabled={loading}
            aria-label="Refresh hearings"
            className="ml-auto flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Stats strip ── */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3">
            <p className="text-xs font-mono text-surface-500 mb-0.5">Open hearings</p>
            <p className="text-lg font-mono font-bold text-emerald">{openCount}</p>
          </div>
          <div className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3">
            <p className="text-xs font-mono text-surface-500 mb-0.5">Committees</p>
            <p className="text-lg font-mono font-bold text-white">10</p>
          </div>
          <div className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3">
            <p className="text-xs font-mono text-surface-500 mb-0.5">Total hearings</p>
            <p className="text-lg font-mono font-bold text-white">{total}</p>
          </div>
        </div>

        {/* ── About section ── */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-100 border border-surface-300 mb-6">
          <Info className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-mono font-semibold text-surface-400 mb-1">How hearings work</p>
            <p className="text-xs text-surface-500 leading-relaxed">
              Each civic committee holds formal hearings on contested topics.
              Citizens submit written testimony (For / Against / Neutral) during the open period.
              The committee chair reviews all evidence and issues a formal recommendation
              that appears on the topic page before the community vote.
            </p>
          </div>
        </div>

        {/* ── Status filter ── */}
        <div className="flex items-center gap-2 mb-4" role="group" aria-label="Filter by hearing status">
          {(['open', 'closed', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              aria-pressed={statusFilter === s}
              className={cn(
                'px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-colors',
                statusFilter === s ? (
                  s === 'open' ? 'bg-emerald/15 border-emerald/40 text-emerald' :
                  s === 'closed' ? 'bg-surface-300 border-surface-400 text-surface-600' :
                  'bg-surface-300 border-surface-400 text-white'
                ) : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-300'
              )}
            >
              {s === 'open' ? 'Open' : s === 'closed' ? 'Closed' : 'All'}
            </button>
          ))}
        </div>

        {/* ── Committee filter ── */}
        <div className="flex items-center gap-2 flex-wrap mb-6">
          {COMMITTEES.map((committee) => {
            const style = getCommitteeStyle(committee)
            const isActive = committeeFilter === committee
            return (
              <button
                key={committee}
                onClick={() => setCommitteeFilter(committee)}
                aria-pressed={isActive}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-mono font-medium transition-colors',
                  isActive && committee !== 'All'
                    ? `${style.bg} ${style.border} ${style.text}`
                    : isActive && committee === 'All'
                    ? 'bg-surface-300 border-surface-400 text-white'
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-300'
                )}
              >
                {committee !== 'All' && (
                  <span className={cn('h-1.5 w-1.5 rounded-full', isActive ? style.dot : 'bg-surface-500')} />
                )}
                {committee}
              </button>
            )
          })}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <HearingsSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-xl bg-surface-200 flex items-center justify-center mb-4">
              <AlertCircle className="h-5 w-5 text-surface-500" />
            </div>
            <p className="text-surface-500 text-sm mb-1">{error}</p>
            <p className="text-surface-600 text-xs mb-4">
              Hearings will be available once committees begin convening sessions.
            </p>
            <Button variant="secondary" size="sm" onClick={fetchHearings}>
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </Button>
          </div>
        ) : hearings.length === 0 ? (
          <EmptyState
            icon={Gavel}
            title="No hearings found"
            description={
              statusFilter === 'open'
                ? 'No committees have open hearings at this time. Check back soon or browse closed hearings for past testimony.'
                : committeeFilter !== 'All'
                ? `The ${committeeFilter} Committee has not held any hearings yet.`
                : 'No hearings match your current filters.'
            }
            action={
              statusFilter !== 'all' ? {
                label: 'View all hearings',
                onClick: () => setStatusFilter('all'),
              } : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {hearings.map((hearing) => (
              <HearingCard key={hearing.id} hearing={hearing} />
            ))}
            {total > hearings.length && (
              <p className="text-xs text-surface-600 text-center py-2">
                Showing {hearings.length} of {total} hearings
              </p>
            )}
          </div>
        )}

        {/* ── Footer nav ── */}
        <div className="mt-10 rounded-2xl border border-surface-300 bg-surface-100 px-6 py-5">
          <p className="text-xs font-mono text-surface-500 mb-3 text-center">
            Related civic institutions
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {[
              { href: '/assembly', label: "Citizens' Assembly" },
              { href: '/senate', label: 'The Senate' },
              { href: '/grand-council', label: 'Grand Council' },
              { href: '/tribunal', label: 'Tribunal' },
              { href: '/civic-convention', label: 'Convention' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
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
