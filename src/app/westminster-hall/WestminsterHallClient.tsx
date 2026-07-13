'use client'

/**
 * /westminster-hall — The Secondary Chamber
 *
 * Any citizen can request a backbench debate slot on any civic topic.
 * Sessions need 5 supporters to be approved; once approved they're
 * scheduled and users can join to make short speeches (≤500 chars).
 * The community "Hear, hear!"s the best speeches.
 *
 * Status lifecycle: requested → approved → scheduled → live → concluded
 * Distinct from /debate (formal FOR/AGAINST), /floor, /spar (1-on-1).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlignLeft,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FlaskConical,
  Gavel,
  GraduationCap,
  Heart,
  Info,
  Landmark,
  Leaf,
  Loader2,
  Mic,
  Music2,
  Plus,
  Radio,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsUp,
  Timer,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { WHSession, WHListResponse } from '@/app/api/westminster-hall/route'
import type { WHSpeech, WHSessionDetail } from '@/app/api/westminster-hall/sessions/[id]/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CAT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Politics:    Landmark,
  Economics:   TrendingUp,
  Technology:  Zap,
  Science:     FlaskConical,
  Ethics:      Scale,
  Philosophy:  Sparkles,
  Culture:     Music2,
  Health:      Heart,
  Education:   GraduationCap,
  Environment: Leaf,
}

const CAT_COLOR: Record<string, string> = {
  Politics:    'text-for-400',
  Economics:   'text-gold',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-for-300',
  Philosophy:  'text-purple',
  Culture:     'text-against-400',
  Health:      'text-emerald',
  Education:   'text-gold',
  Environment: 'text-emerald',
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot?: string }> = {
  requested:  { label: 'Requested',  color: 'text-surface-400', bg: 'bg-surface-200', border: 'border-surface-400' },
  approved:   { label: 'Approved',   color: 'text-gold',        bg: 'bg-gold/10',     border: 'border-gold/30' },
  scheduled:  { label: 'Scheduled',  color: 'text-for-400',     bg: 'bg-for-500/10',  border: 'border-for-500/30' },
  live:       { label: 'LIVE',       color: 'text-emerald',     bg: 'bg-emerald/10',  border: 'border-emerald/30', dot: 'bg-emerald' },
  concluded:  { label: 'Concluded',  color: 'text-surface-500', bg: 'bg-surface-100', border: 'border-surface-300' },
  withdrawn:  { label: 'Withdrawn',  color: 'text-surface-600', bg: 'bg-surface-100', border: 'border-surface-300' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.requested
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold',
      'border', cfg.color, cfg.bg, cfg.border
    )}>
      {cfg.dot && <span className={cn('h-1.5 w-1.5 rounded-full animate-pulse', cfg.dot)} />}
      {cfg.label}
    </span>
  )
}

// ─── Duration badge ───────────────────────────────────────────────────────────

function DurationBadge({ mins }: { mins: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-500">
      <Clock className="h-3 w-3" />
      {mins}min
    </span>
  )
}

// ─── Support button ───────────────────────────────────────────────────────────

function SupportButton({
  sessionId,
  supported,
  count,
  threshold,
  onToggle,
}: {
  sessionId: string
  supported: boolean
  count: number
  threshold: number
  onToggle: (id: string, nowSupported: boolean) => void
}) {
  const [busy, setBusy] = useState(false)
  const pct = Math.min(100, Math.round((count / threshold) * 100))

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/westminster-hall/sessions/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'support' }),
      })
      if (res.ok) {
        const data = await res.json() as { supported: boolean }
        onToggle(sessionId, data.supported)
      }
    } catch {
      // best-effort
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold',
        'border transition-all disabled:opacity-50',
        supported
          ? 'bg-for-600/20 border-for-600/40 text-for-400'
          : 'bg-surface-200 border-surface-400 text-surface-400 hover:text-white hover:border-for-500/50'
      )}
    >
      {busy
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : supported
          ? <Check className="h-3.5 w-3.5" />
          : <Users className="h-3.5 w-3.5" />
      }
      <span>{count}/{threshold}</span>
      {pct < 100 && (
        <span className="hidden sm:inline text-[9px] text-surface-600">
          · {pct}%
        </span>
      )}
    </button>
  )
}

// ─── Session card ─────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onSupportToggle,
  onClick,
}: {
  session: WHSession
  onSupportToggle: (id: string, nowSupported: boolean) => void
  onClick: (session: WHSession) => void
}) {
  const CatIcon = CAT_ICON[session.category ?? ''] ?? Mic
  const catColor = CAT_COLOR[session.category ?? ''] ?? 'text-surface-500'
  const isLive = session.status === 'live'
  const isRequested = session.status === 'requested'
  const needsSupport = isRequested && session.support_count < session.support_threshold

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-4 cursor-pointer transition-colors',
        isLive
          ? 'border-emerald/30 bg-emerald/5 hover:border-emerald/50'
          : 'border-surface-300 bg-surface-100 hover:border-surface-400'
      )}
      onClick={() => onClick(session)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <StatusBadge status={session.status} />
            <DurationBadge mins={session.duration_mins} />
            {session.category && (
              <span className={cn('text-[10px] font-mono font-semibold flex items-center gap-1', catColor)}>
                <CatIcon className="h-3 w-3" />
                {session.category}
              </span>
            )}
          </div>
          <h3 className="font-mono text-sm font-bold text-white leading-snug line-clamp-2">
            {session.title}
          </h3>
        </div>
        <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0 mt-1" />
      </div>

      {/* Motion text */}
      <p className="text-xs font-mono text-surface-400 leading-relaxed line-clamp-2 mb-3 italic">
        &ldquo;{session.motion}&rdquo;
      </p>

      {/* Related topic */}
      {session.topic && (
        <div className="flex items-center gap-1.5 mb-3 p-2 rounded-lg bg-surface-200/60 border border-surface-300">
          <BookOpen className="h-3 w-3 text-for-400 flex-shrink-0" />
          <span className="text-[11px] font-mono text-surface-400 truncate">
            {session.topic.statement}
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Avatar
            src={session.requester.avatar_url}
            fallback={session.requester.display_name || session.requester.username}
            size="xs"
          />
          <span className="text-[11px] font-mono text-surface-500 truncate max-w-[100px]">
            {session.requester.display_name || session.requester.username}
          </span>
          {session.speech_count > 0 && (
            <span className="text-[10px] font-mono text-surface-600">
              · {session.speech_count} speech{session.speech_count !== 1 ? 'es' : ''}
            </span>
          )}
        </div>

        {needsSupport && (
          <SupportButton
            sessionId={session.id}
            supported={session.user_supported}
            count={session.support_count}
            threshold={session.support_threshold}
            onToggle={onSupportToggle}
          />
        )}
      </div>
    </motion.div>
  )
}

// ─── Session detail panel ─────────────────────────────────────────────────────

function SpeechBubble({
  speech,
  sessionId,
  onHearToggle,
}: {
  speech: WHSpeech
  sessionId: string
  onHearToggle: (id: string, nowHeard: boolean) => void
}) {
  // The hear endpoint uses the session ID as prefix — we need to pass it separately
  // For simplicity, the toggle uses the session endpoint with speech_id in body
  const [heard, setHeard] = useState(speech.user_heard)
  const [hearCount, setHearCount] = useState(speech.hear_count)

  async function toggleHear(e: React.MouseEvent) {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/westminster-hall/sessions/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'hear', speech_id: speech.id }),
      })
      if (res.ok) {
        const data = await res.json() as { heard: boolean }
        setHeard(data.heard)
        setHearCount((c) => data.heard ? c + 1 : c - 1)
        onHearToggle(speech.id, data.heard)
      }
    } catch {
      // best-effort
    }
  }

  const timeStr = new Date(speech.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3"
    >
      <Avatar
        src={speech.speaker.avatar_url}
        fallback={speech.speaker.display_name || speech.speaker.username}
        size="sm"
        className="flex-shrink-0 mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Link
            href={`/profile/${speech.speaker.username}`}
            className="text-xs font-mono font-semibold text-white hover:text-for-300 transition-colors"
          >
            {speech.speaker.display_name || speech.speaker.username}
          </Link>
          <span className="text-[10px] font-mono text-surface-600">{timeStr}</span>
          {speech.speaker.clout > 0 && (
            <span className="text-[10px] font-mono text-gold">{speech.speaker.clout.toLocaleString()} clout</span>
          )}
        </div>
        <div className="rounded-xl bg-surface-200 border border-surface-300 px-3 py-2.5 mb-1.5">
          <p className="text-sm font-mono text-surface-300 leading-relaxed whitespace-pre-wrap">{speech.content}</p>
        </div>
        <button
          onClick={toggleHear}
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-mono transition-all',
            'border',
            heard
              ? 'bg-for-500/15 border-for-500/30 text-for-400'
              : 'bg-transparent border-transparent text-surface-600 hover:text-white hover:border-surface-400'
          )}
        >
          <ThumbsUp className={cn('h-3 w-3', heard && 'fill-for-400/30')} />
          {hearCount > 0 ? <span>{hearCount} Hear, hear!</span> : <span>Hear, hear!</span>}
        </button>
      </div>
    </motion.div>
  )
}

function SessionDetail({
  session: initialSession,
  onClose,
}: {
  session: WHSession
  onClose: () => void
}) {
  const [detail, setDetail] = useState<WHSessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [speechText, setSpeechText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [supported, setSupported] = useState(initialSession.user_supported)
  const [supportCount, setSupportCount] = useState(initialSession.support_count)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/westminster-hall/sessions/${initialSession.id}`)
      if (res.ok) {
        const data = await res.json() as WHSessionDetail
        setDetail(data)
        setSupported(data.user_supported)
        setSupportCount(data.support_count)
      }
    } finally {
      setLoading(false)
    }
  }, [initialSession.id])

  useEffect(() => {
    load()
    if (initialSession.status === 'live') {
      pollRef.current = setInterval(load, 10_000)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [load, initialSession.status])

  async function toggleSupport() {
    try {
      const res = await fetch(`/api/westminster-hall/sessions/${initialSession.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'support' }),
      })
      if (res.ok) {
        const data = await res.json() as { supported: boolean }
        setSupported(data.supported)
        setSupportCount((c) => data.supported ? c + 1 : c - 1)
      }
    } catch {
      // best-effort
    }
  }

  async function submitSpeech() {
    if (!speechText.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/westminster-hall/sessions/${initialSession.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'speech', content: speechText.trim() }),
      })
      if (res.ok) {
        setSpeechText('')
        await load()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const isLive = initialSession.status === 'live'
  const needsSupport = initialSession.status === 'requested'
  const CatIcon = CAT_ICON[initialSession.category ?? ''] ?? Mic
  const catColor = CAT_COLOR[initialSession.category ?? ''] ?? 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-surface-50"
    >
      {/* Top header */}
      <div className="flex-shrink-0 border-b border-surface-300 bg-surface-100">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={initialSession.status} />
              <DurationBadge mins={initialSession.duration_mins} />
              {initialSession.category && (
                <span className={cn('text-[10px] font-mono font-semibold flex items-center gap-1', catColor)}>
                  <CatIcon className="h-3 w-3" />
                  {initialSession.category}
                </span>
              )}
            </div>
            <h1 className="font-mono text-sm font-bold text-white truncate mt-0.5">
              {initialSession.title}
            </h1>
          </div>
          {isLive && (
            <button
              onClick={load}
              className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">

          {/* Motion */}
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-xl bg-gold/10 border border-gold/30 mt-0.5">
                <AlignLeft className="h-4 w-4 text-gold" />
              </div>
              <div>
                <p className="text-[10px] font-mono font-semibold text-surface-600 uppercase tracking-wider mb-1">Motion</p>
                <p className="text-sm font-mono text-surface-300 leading-relaxed italic">
                  &ldquo;{initialSession.motion}&rdquo;
                </p>
              </div>
            </div>
          </div>

          {/* Requester + support */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Avatar
                src={initialSession.requester.avatar_url}
                fallback={initialSession.requester.display_name || initialSession.requester.username}
                size="sm"
              />
              <div>
                <p className="text-xs font-mono font-semibold text-white">
                  {initialSession.requester.display_name || initialSession.requester.username}
                </p>
                <p className="text-[10px] font-mono text-surface-600">Requested by</p>
              </div>
            </div>

            {needsSupport && (
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-xs font-mono text-surface-500">
                    {supportCount}/{initialSession.support_threshold} supporters
                  </p>
                  <div className="h-1 w-24 rounded-full bg-surface-300 mt-1">
                    <div
                      className="h-full rounded-full bg-for-500 transition-all"
                      style={{ width: `${Math.min(100, (supportCount / initialSession.support_threshold) * 100)}%` }}
                    />
                  </div>
                </div>
                <button
                  onClick={toggleSupport}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                    supported
                      ? 'bg-for-600/20 border-for-600/40 text-for-400'
                      : 'bg-surface-200 border-surface-400 text-surface-400 hover:text-white hover:border-for-500/50'
                  )}
                >
                  {supported ? <Check className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                  {supported ? 'Supporting' : 'Support'}
                </button>
              </div>
            )}
          </div>

          {/* Related topic */}
          {initialSession.topic && (
            <Link
              href={`/topic/${initialSession.topic.id}`}
              className="flex items-center gap-3 p-3 rounded-xl border border-surface-300 bg-surface-100 hover:border-for-500/40 hover:bg-for-500/5 transition-colors group"
            >
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-for-500/10 border border-for-500/30 flex-shrink-0">
                <BookOpen className="h-4 w-4 text-for-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono text-surface-600 mb-0.5">Related Debate</p>
                <p className="text-xs font-mono text-surface-300 leading-snug line-clamp-1">
                  {initialSession.topic.statement}
                </p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          )}

          {/* Speeches */}
          <div>
            <h2 className="font-mono text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Mic className="h-3.5 w-3.5" />
              {loading ? 'Loading speeches…' : `${detail?.speeches.length ?? 0} speech${(detail?.speeches.length ?? 0) !== 1 ? 'es' : ''}`}
            </h2>

            {loading ? (
              <div className="space-y-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-16 rounded-xl" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (detail?.speeches.length ?? 0) === 0 ? (
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6 text-center">
                <Mic className="h-8 w-8 text-surface-600 mx-auto mb-2" />
                <p className="text-sm font-mono text-surface-500">
                  {isLive ? 'No speeches yet — be the first to rise!' : 'No speeches in this session.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence>
                  {detail!.speeches.map((speech) => (
                    <SpeechBubble
                      key={speech.id}
                      speech={speech}
                      sessionId={initialSession.id}
                      onHearToggle={() => {}}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Speech input — only when live */}
          {isLive && (
            <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
              <h3 className="font-mono text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
                Rise to speak
              </h3>
              <textarea
                ref={textareaRef}
                value={speechText}
                onChange={(e) => setSpeechText(e.target.value.slice(0, 500))}
                placeholder="Address the house… (up to 500 characters)"
                rows={3}
                className={cn(
                  'w-full resize-none rounded-xl bg-surface-200 border px-3 py-2.5',
                  'text-sm font-mono text-white placeholder:text-surface-600',
                  'focus:outline-none focus:ring-1 focus:ring-for-500/50',
                  speechText.length > 450 ? 'border-gold/50' : 'border-surface-400'
                )}
              />
              <div className="flex items-center justify-between mt-2">
                <span className={cn(
                  'text-[10px] font-mono',
                  speechText.length > 450 ? 'text-gold' : 'text-surface-600'
                )}>
                  {speechText.length}/500
                </span>
                <button
                  onClick={submitSpeech}
                  disabled={submitting || speechText.trim().length < 5}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                    'disabled:opacity-40',
                    speechText.trim().length >= 5
                      ? 'bg-for-600 border-for-600 text-white hover:bg-for-500'
                      : 'bg-surface-200 border-surface-300 text-surface-500'
                  )}
                >
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mic className="h-3.5 w-3.5" />}
                  {submitting ? 'Rising…' : 'Deliver speech'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Request form ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Education', 'Environment',
]

function RequestForm({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [motion, setMotion] = useState('')
  const [category, setCategory] = useState('')
  const [duration, setDuration] = useState(30)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/westminster-hall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          motion: motion.trim(),
          category: category || undefined,
          duration_mins: duration,
        }),
      })
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        setError(body.error ?? 'Submission failed')
        return
      }
      // Refresh and close
      onClose()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-surface-50"
    >
      {/* Header */}
      <div className="flex-shrink-0 border-b border-surface-300 bg-surface-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors">
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gold/10 border border-gold/30">
              <Mic className="h-3.5 w-3.5 text-gold" />
            </div>
            <h1 className="font-mono text-sm font-bold text-white">Request a Westminster Hall Slot</h1>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto">
        <form onSubmit={submit} className="max-w-2xl mx-auto px-4 py-6 space-y-5">
          {/* How it works */}
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-for-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs font-mono text-surface-400 space-y-1 leading-relaxed">
                <p>Westminster Hall sessions need <span className="text-white font-semibold">5 supporters</span> before they&apos;re approved for scheduling.</p>
                <p>Sessions are open discussions — no formal FOR/AGAINST sides. Contributors make short speeches (up to 500 characters) and the community &ldquo;Hear, hear!&rdquo; the best ones.</p>
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider mb-1.5">
              Session title <span className="text-against-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 200))}
              placeholder="e.g. The Future of AI in Public Governance"
              className="w-full rounded-xl bg-surface-200 border border-surface-400 px-3 py-2.5 text-sm font-mono text-white placeholder:text-surface-600 focus:outline-none focus:ring-1 focus:ring-for-500/50"
              required
              minLength={5}
            />
            <p className="text-[10px] font-mono text-surface-600 mt-1">{title.length}/200</p>
          </div>

          {/* Motion */}
          <div>
            <label className="block text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider mb-1.5">
              Motion <span className="text-against-400">*</span>
            </label>
            <textarea
              value={motion}
              onChange={(e) => setMotion(e.target.value.slice(0, 500))}
              placeholder='"This House believes that…" or "This House notes with concern…"'
              rows={3}
              className="w-full resize-none rounded-xl bg-surface-200 border border-surface-400 px-3 py-2.5 text-sm font-mono text-white placeholder:text-surface-600 focus:outline-none focus:ring-1 focus:ring-for-500/50"
              required
              minLength={10}
            />
            <p className="text-[10px] font-mono text-surface-600 mt-1">{motion.length}/500</p>
          </div>

          {/* Category + Duration row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl bg-surface-200 border border-surface-400 px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:ring-1 focus:ring-for-500/50 appearance-none cursor-pointer"
              >
                <option value="">Any category</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider mb-1.5">
                Duration
              </label>
              <div className="flex gap-2">
                {[30, 60, 90].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-xs font-mono font-semibold border transition-all',
                      duration === d
                        ? 'bg-for-600/20 border-for-600/40 text-for-400'
                        : 'bg-surface-200 border-surface-400 text-surface-500 hover:text-white'
                    )}
                  >
                    {d}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-against-500/40 bg-against-500/10 px-3 py-2.5">
              <p className="text-xs font-mono text-against-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={busy || title.trim().length < 5 || motion.trim().length < 10}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
              'font-mono text-sm font-semibold border transition-all',
              'disabled:opacity-40',
              (!busy && title.trim().length >= 5 && motion.trim().length >= 10)
                ? 'bg-for-600 border-for-600 text-white hover:bg-for-500'
                : 'bg-surface-200 border-surface-300 text-surface-500'
            )}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
            {busy ? 'Submitting request…' : 'Request Westminster Hall Slot'}
          </button>
        </form>
      </div>
    </motion.div>
  )
}

// ─── Tab filter ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'all',       label: 'All' },
  { id: 'live',      label: 'Live' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'requested', label: 'Petitioning' },
] as const

type TabId = typeof TABS[number]['id']

// ─── Main page ────────────────────────────────────────────────────────────────

export function WestminsterHallClient() {
  const [data, setData] = useState<WHListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabId>('all')
  const [selectedSession, setSelectedSession] = useState<WHSession | null>(null)
  const [showRequestForm, setShowRequestForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/westminster-hall')
      if (res.ok) setData(await res.json() as WHListResponse)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function handleSupportToggle(id: string, nowSupported: boolean) {
    setData((d) => {
      if (!d) return d
      return {
        sessions: d.sessions.map((s) =>
          s.id === id
            ? { ...s, user_supported: nowSupported, support_count: nowSupported ? s.support_count + 1 : s.support_count - 1 }
            : s
        ),
      }
    })
  }

  const allSessions = data?.sessions ?? []
  const filtered = tab === 'all'
    ? allSessions
    : tab === 'requested'
      ? allSessions.filter((s) => s.status === 'requested' || s.status === 'approved')
      : allSessions.filter((s) => s.status === tab)

  const liveSessions = allSessions.filter((s) => s.status === 'live')

  if (selectedSession) {
    return (
      <AnimatePresence>
        <SessionDetail
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      </AnimatePresence>
    )
  }

  if (showRequestForm) {
    return (
      <AnimatePresence>
        <RequestForm
          onClose={() => { setShowRequestForm(false); load() }}
        />
      </AnimatePresence>
    )
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30">
              <Mic className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Westminster Hall</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">The backbench debating chamber</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="p-2 rounded-lg border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
            <button
              onClick={() => setShowRequestForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gold/10 border border-gold/30 text-gold text-xs font-mono font-semibold hover:bg-gold/20 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Request slot
            </button>
          </div>
        </div>

        {/* Live sessions banner */}
        {liveSessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-emerald/30 bg-emerald/5 p-4 mb-5 cursor-pointer hover:bg-emerald/10 transition-colors"
            onClick={() => setSelectedSession(liveSessions[0])}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-emerald/15 border border-emerald/30 flex-shrink-0">
                <Radio className="h-4 w-4 text-emerald animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-mono font-semibold text-emerald uppercase tracking-wider flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse" />
                    Live in session
                  </span>
                </div>
                <p className="text-sm font-mono text-white font-semibold truncate">
                  {liveSessions[0].title}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-emerald flex-shrink-0" />
            </div>
          </motion.div>
        )}

        {/* How it works */}
        <details className="rounded-xl border border-surface-300 bg-surface-100 overflow-hidden mb-5 group">
          <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none select-none hover:bg-surface-200/40 transition-colors">
            <div className="flex items-center gap-2">
              <Info className="h-3.5 w-3.5 text-surface-500" />
              <span className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">How Westminster Hall works</span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-surface-500 transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
            {[
              { icon: Plus, label: '1. Request a slot', desc: 'Propose a motion and request a 30–90 minute session on any civic topic.' },
              { icon: Users, label: '2. Gather supporters', desc: 'Collect 5 supporter signatures from fellow citizens for approval.' },
              { icon: Mic, label: '3. Lead the debate', desc: 'Once live, any citizen can rise to speak. Community "Hear, hear!" the best speeches.' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="rounded-lg bg-surface-200/60 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className="h-3.5 w-3.5 text-gold" />
                  <span className="text-white font-semibold">{label}</span>
                </div>
                <p className="text-surface-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </details>

        {/* Tab filter */}
        <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
          {TABS.map((t) => {
            const count = t.id === 'all'
              ? allSessions.length
              : t.id === 'requested'
                ? allSessions.filter((s) => s.status === 'requested' || s.status === 'approved').length
                : allSessions.filter((s) => s.status === t.id).length
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all flex-shrink-0',
                  tab === t.id
                    ? 'bg-for-600/20 border-for-600/40 text-for-400'
                    : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                )}
              >
                {t.label}
                {count > 0 && (
                  <span className={cn(
                    'flex items-center justify-center h-4 min-w-[16px] px-0.5 rounded-full text-[9px] font-bold',
                    tab === t.id ? 'bg-for-600/40 text-for-300' : 'bg-surface-300 text-surface-500'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Sessions grid */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-48 rounded-2xl" />
                ))}
              </div>
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon={Mic}
                title={tab === 'live' ? 'No live sessions' : tab === 'scheduled' ? 'Nothing scheduled' : 'No sessions yet'}
                description={
                  tab === 'live'
                    ? 'Check back later — live debates appear here as they start.'
                    : tab === 'all'
                      ? 'Be the first to request a Westminster Hall debate slot.'
                      : 'No sessions in this category yet.'
                }
                actions={[
                  { label: 'Request a slot', onClick: () => setShowRequestForm(true) },
                  { label: 'View Parliament', href: '/parliament' },
                ]}
              />
            </motion.div>
          ) : (
            <motion.div
              key={`list-${tab}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {filtered.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onSupportToggle={handleSupportToggle}
                  onClick={setSelectedSession}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Related pages */}
        <div className="mt-8 pt-5 border-t border-surface-300">
          <h2 className="font-mono text-xs font-semibold text-surface-600 uppercase tracking-wider mb-3">
            Parliament
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { href: '/parliament',    label: 'Parliament Hub',   icon: Landmark,      color: 'text-gold' },
              { href: '/floor',         label: 'The Floor',        icon: Users,         color: 'text-for-400' },
              { href: '/lords',         label: 'House of Lords',   icon: Gavel,         color: 'text-purple' },
              { href: '/hansard',       label: 'Hansard',          icon: BookOpen,      color: 'text-emerald' },
              { href: '/order-paper',   label: 'Order Paper',      icon: AlignLeft,     color: 'text-gold' },
              { href: '/edm',           label: 'Early Day Motions', icon: Timer,        color: 'text-against-400' },
            ].map((link) => {
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 rounded-lg border border-surface-300 bg-surface-100 px-3 py-2.5 hover:border-surface-400 hover:bg-surface-200/60 transition-colors group"
                >
                  <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', link.color)} />
                  <span className="text-xs font-mono text-surface-500 group-hover:text-white transition-colors truncate">{link.label}</span>
                  <ArrowRight className="h-3 w-3 text-surface-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </Link>
              )
            })}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
