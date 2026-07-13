'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  Clock,
  ExternalLink,
  Gavel,
  Loader2,
  Mic,
  Send,
  ThumbsUp,
  TrendingUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type { WHSpeech, WHSessionDetail } from '@/app/api/westminster-hall/sessions/[id]/route'

// ─── Status config (mirrors WestminsterHallClient) ───────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot?: string }> = {
  requested:  { label: 'Requested',  color: 'text-surface-400', bg: 'bg-surface-200',    border: 'border-surface-400' },
  approved:   { label: 'Approved',   color: 'text-gold',        bg: 'bg-gold/10',         border: 'border-gold/30' },
  scheduled:  { label: 'Scheduled',  color: 'text-for-400',     bg: 'bg-for-500/10',      border: 'border-for-500/30' },
  live:       { label: 'LIVE',       color: 'text-emerald',     bg: 'bg-emerald/10',      border: 'border-emerald/30', dot: 'bg-emerald' },
  concluded:  { label: 'Concluded',  color: 'text-surface-500', bg: 'bg-surface-100',     border: 'border-surface-300' },
  withdrawn:  { label: 'Withdrawn',  color: 'text-surface-600', bg: 'bg-surface-100',     border: 'border-surface-300' },
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

// ─── Speech bubble ────────────────────────────────────────────────────────────

function SpeechBubble({
  speech,
  sessionId,
  isCurrentUser,
  onHearToggle,
}: {
  speech: WHSpeech
  sessionId: string
  isCurrentUser: boolean
  onHearToggle: (speechId: string, nowHeard: boolean, delta: number) => void
}) {
  const [busy, setBusy] = useState(false)
  const speakerName = speech.speaker.display_name ?? speech.speaker.username

  async function toggleHear(e: React.MouseEvent) {
    e.preventDefault()
    if (busy || isCurrentUser) return
    setBusy(true)
    try {
      const res = await fetch(`/api/westminster-hall/sessions/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'hear', speech_id: speech.id }),
      })
      if (res.ok) {
        const data = await res.json() as { heard: boolean }
        onHearToggle(speech.id, data.heard, data.heard ? 1 : -1)
      }
    } catch {
      // best-effort
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3"
    >
      <Link href={`/profile/${speech.speaker.username}`} className="flex-shrink-0 mt-0.5">
        <Avatar
          src={speech.speaker.avatar_url}
          username={speech.speaker.username}
          size={32}
        />
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Link
            href={`/profile/${speech.speaker.username}`}
            className="text-xs font-mono font-semibold text-white hover:text-for-400 transition-colors"
          >
            {speakerName}
          </Link>
          <span className="text-[10px] text-surface-600 font-mono">
            {new Date(speech.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="rounded-xl rounded-tl-sm bg-surface-100 border border-surface-300 px-3.5 py-2.5">
          <p className="text-sm text-surface-100 leading-relaxed whitespace-pre-wrap break-words">
            {speech.content}
          </p>
        </div>

        <button
          onClick={toggleHear}
          disabled={busy || isCurrentUser}
          className={cn(
            'mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono',
            'border transition-all disabled:cursor-default',
            speech.user_heard
              ? 'bg-for-600/20 border-for-600/40 text-for-400'
              : 'bg-surface-200/50 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
            isCurrentUser && 'opacity-50'
          )}
        >
          {busy
            ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
            : <ThumbsUp className="h-2.5 w-2.5" />
          }
          <span>Hear, hear! {speech.hear_count > 0 && `· ${speech.hear_count}`}</span>
        </button>
      </div>
    </motion.div>
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
  onToggle: (nowSupported: boolean) => void
}) {
  const [busy, setBusy] = useState(false)
  const pct = Math.min(100, Math.round((count / threshold) * 100))

  async function toggle() {
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
        onToggle(data.supported)
      }
    } catch {
      // best-effort
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggle}
        disabled={busy}
        className={cn(
          'flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-mono font-semibold',
          'border transition-all disabled:opacity-50',
          supported
            ? 'bg-for-600/20 border-for-600/40 text-for-400'
            : 'bg-surface-200 border-surface-400 text-surface-400 hover:text-white hover:border-for-500/50'
        )}
      >
        {busy
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : supported
            ? <Check className="h-4 w-4" />
            : <Users className="h-4 w-4" />
        }
        Support {count}/{threshold}
      </button>

      {/* Progress bar */}
      <div className="flex-1 max-w-32 h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <div
          className="h-full rounded-full bg-for-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-surface-500">{pct}%</span>
    </div>
  )
}

// ─── Main client component ────────────────────────────────────────────────────

interface Props {
  session: WHSessionDetail
  currentUserId: string | null
}

export function SessionDetailClient({ session: initialSession, currentUserId }: Props) {
  const [session, setSession] = useState(initialSession)
  const [speeches, setSpeeches] = useState<WHSpeech[]>(initialSession.speeches)
  const [speechText, setSpeechText] = useState('')
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const isLive = session.status === 'live'
  const canSpeak = isLive && !!currentUserId

  const handleSupportToggle = useCallback((nowSupported: boolean) => {
    setSession((prev) => ({
      ...prev,
      user_supported: nowSupported,
      support_count: prev.support_count + (nowSupported ? 1 : -1),
    }))
  }, [])

  const handleHearToggle = useCallback((speechId: string, nowHeard: boolean, delta: number) => {
    setSpeeches((prev) =>
      prev.map((s) =>
        s.id === speechId
          ? { ...s, user_heard: nowHeard, hear_count: Math.max(0, s.hear_count + delta) }
          : s
      )
    )
  }, [])

  async function submitSpeech(e: React.FormEvent) {
    e.preventDefault()
    const content = speechText.trim()
    if (!content || posting) return
    if (content.length < 5 || content.length > 500) {
      setPostError('Speech must be 5–500 characters')
      return
    }

    setPosting(true)
    setPostError(null)
    try {
      const res = await fetch(`/api/westminster-hall/sessions/${session.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'speech', content }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        setPostError(err.error ?? 'Failed to post speech')
        return
      }

      // Re-fetch speeches
      const detailRes = await fetch(`/api/westminster-hall/sessions/${session.id}`)
      if (detailRes.ok) {
        const detail = await detailRes.json() as WHSessionDetail
        setSpeeches(detail.speeches)
        setSession((prev) => ({ ...prev, speech_count: detail.speech_count }))
      }

      setSpeechText('')
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } finally {
      setPosting(false)
    }
  }

  const scheduledDate = session.scheduled_at
    ? new Date(session.scheduled_at).toLocaleDateString([], {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-16 pb-28 md:pb-12">

        {/* Back nav */}
        <Link
          href="/westminster-hall"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-5 mt-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Westminster Hall
        </Link>

        {/* Session header */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-5">
          {/* Status + duration */}
          <div className="flex items-center gap-2 mb-3">
            <StatusBadge status={session.status} />
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-500">
              <Clock className="h-3 w-3" />
              {session.duration_mins}min
            </span>
            {session.category && (
              <span className="text-[10px] font-mono text-surface-500 border border-surface-300 rounded-full px-2 py-0.5">
                {session.category}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-lg font-mono font-bold text-white leading-tight mb-2">
            {session.title}
          </h1>

          {/* Motion */}
          <div className="flex gap-2 mb-4">
            <Gavel className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-surface-400 italic leading-relaxed">
              &ldquo;{session.motion}&rdquo;
            </p>
          </div>

          {/* Requester */}
          <div className="flex items-center gap-2 mb-4">
            <Avatar
              src={session.requester.avatar_url}
              username={session.requester.username}
              size={24}
            />
            <span className="text-xs text-surface-500 font-mono">
              Requested by{' '}
              <Link
                href={`/profile/${session.requester.username}`}
                className="text-white hover:text-for-400 transition-colors"
              >
                {session.requester.display_name ?? session.requester.username}
              </Link>
            </span>
            {scheduledDate && (
              <span className="ml-auto text-[10px] text-surface-600 font-mono">
                {scheduledDate}
              </span>
            )}
          </div>

          {/* Support (only for non-live/concluded) */}
          {(session.status === 'requested' || session.status === 'approved') && currentUserId && (
            <SupportButton
              sessionId={session.id}
              supported={session.user_supported}
              count={session.support_count}
              threshold={session.support_threshold}
              onToggle={handleSupportToggle}
            />
          )}

          {/* Stats row */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-surface-200">
            <span className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
              <Users className="h-3.5 w-3.5" />
              {session.support_count} supporters
            </span>
            <span className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
              <Mic className="h-3.5 w-3.5" />
              {session.speech_count} speeches
            </span>
          </div>
        </div>

        {/* Related topic */}
        {session.topic && (
          <Link
            href={`/topic/${session.topic.id}`}
            className="block rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 mb-5 hover:border-for-500/40 transition-colors group"
          >
            <div className="flex items-start gap-2.5">
              <TrendingUp className="h-4 w-4 text-for-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-0.5">
                  Related Topic
                </p>
                <p className="text-sm text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
                  {session.topic.statement}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xs font-mono font-bold text-for-400">
                  {Math.round(session.topic.blue_pct)}%
                </div>
                <div className="text-[10px] text-surface-600 font-mono">
                  {session.topic.total_votes.toLocaleString()} votes
                </div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-surface-600 group-hover:text-for-400 transition-colors flex-shrink-0 mt-0.5" />
            </div>
          </Link>
        )}

        {/* Speeches */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-4">
            <Mic className="h-4 w-4 text-surface-500" />
            <h2 className="text-sm font-mono font-semibold text-surface-400">
              {speeches.length > 0 ? `${speeches.length} Speeches` : 'No speeches yet'}
            </h2>
            {isLive && (
              <span className="ml-auto flex items-center gap-1 text-[10px] font-mono text-emerald">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse" />
                Session is live
              </span>
            )}
          </div>

          {speeches.length === 0 ? (
            <div className="text-center py-12 rounded-2xl bg-surface-100 border border-surface-200 border-dashed">
              <Mic className="h-8 w-8 text-surface-600 mx-auto mb-2" />
              <p className="text-sm text-surface-500 font-mono">
                {isLive ? 'Be the first to speak' : 'No speeches yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <AnimatePresence initial={false}>
                {speeches.map((speech) => (
                  <SpeechBubble
                    key={speech.id}
                    speech={speech}
                    sessionId={session.id}
                    isCurrentUser={speech.speaker.id === currentUserId}
                    onHearToggle={handleHearToggle}
                  />
                ))}
              </AnimatePresence>
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Speech input — only when live */}
        {canSpeak && (
          <form
            onSubmit={submitSpeech}
            className="sticky bottom-[4.5rem] md:bottom-4 rounded-2xl bg-surface-100 border border-surface-300 p-4 shadow-xl"
          >
            <div className="flex items-start gap-2">
              <textarea
                ref={textareaRef}
                value={speechText}
                onChange={(e) => setSpeechText(e.target.value)}
                placeholder="Rise to speak… (5–500 characters)"
                rows={2}
                maxLength={500}
                className={cn(
                  'flex-1 resize-none bg-surface-200 border rounded-xl px-3 py-2',
                  'text-sm text-white placeholder:text-surface-600 font-mono',
                  'focus:outline-none focus:ring-1 focus:ring-for-500/50 transition-all',
                  postError ? 'border-against-600' : 'border-surface-300 focus:border-for-500/50'
                )}
              />
              <button
                type="submit"
                disabled={posting || speechText.trim().length < 5}
                className={cn(
                  'flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center',
                  'bg-for-600 text-white border border-for-500',
                  'hover:bg-for-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
                )}
              >
                {posting
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />
                }
              </button>
            </div>

            <div className="flex items-center justify-between mt-1.5 px-1">
              {postError ? (
                <p className="text-[10px] text-against-400 font-mono">{postError}</p>
              ) : (
                <span />
              )}
              <span className={cn(
                'text-[10px] font-mono',
                speechText.length > 450 ? 'text-against-400' : 'text-surface-600'
              )}>
                {speechText.length}/500
              </span>
            </div>
          </form>
        )}

        {/* Not-live notice */}
        {!isLive && session.status !== 'concluded' && (
          <div className="rounded-xl bg-surface-100 border border-surface-200 px-4 py-3 text-center">
            <p className="text-xs text-surface-500 font-mono">
              {session.status === 'requested' || session.status === 'approved'
                ? 'Speeches open when the session goes live'
                : session.status === 'scheduled'
                  ? scheduledDate
                    ? `Session opens ${scheduledDate}`
                    : 'Session is scheduled — check back soon'
                  : 'Session ended'}
            </p>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
