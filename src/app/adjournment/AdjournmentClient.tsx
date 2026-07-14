'use client'

/**
 * /adjournment — Adjournment Debates
 *
 * Citizens apply to raise a specific civic issue in a daily 30-minute debate.
 * Applications are seconded by other citizens; the most-supported application
 * is selected each day. The selected citizen delivers an opening speech,
 * others may contribute floor speeches, and a ministerial response closes it.
 *
 * Distinct from:
 *   /debates       — structured for/against debates on topics
 *   /edm           — Early Day Motions (non-debate notices of concern)
 *   /oral-questions — departmental questions, not free-topic debate
 *   /westminster-hall — secondary chamber debates on pre-agreed topics
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileText,
  Gavel,
  Loader2,
  MessageSquare,
  Mic,
  Mic2,
  Moon,
  Plus,
  RefreshCw,
  Shield,
  ThumbsUp,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  AdjournmentApplication,
  AdjournmentListResponse,
  AdjournmentSpeech,
} from '@/app/api/adjournment/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

// ─── Category colours ─────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
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

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Gavel }> = {
  pending:   { label: 'Awaiting Ballot', color: 'text-gold',       icon: Clock },
  selected:  { label: 'Selected',        color: 'text-purple',     icon: Gavel },
  open:      { label: 'Debate Open',     color: 'text-for-400',    icon: Mic },
  closed:    { label: 'Concluded',       color: 'text-surface-500', icon: CheckCircle2 },
  withdrawn: { label: 'Withdrawn',       color: 'text-surface-500', icon: XCircle },
}

// ─── Speech type config ───────────────────────────────────────────────────────

const SPEECH_TYPE_CONFIG = {
  opening:  { label: 'Opening Statement', icon: Mic,     color: 'text-for-400',   border: 'border-for-500/30',   bg: 'bg-for-500/5' },
  floor:    { label: 'Floor Contribution', icon: MessageSquare, color: 'text-purple', border: 'border-purple/30', bg: 'bg-purple/5' },
  response: { label: 'Ministerial Response', icon: Shield, color: 'text-gold',    border: 'border-gold/30',      bg: 'bg-gold/5' },
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function SpeechCard({ speech }: { speech: AdjournmentSpeech }) {
  const cfg = SPEECH_TYPE_CONFIG[speech.speech_type]
  const Icon = cfg.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-lg border p-4 space-y-2', cfg.border, cfg.bg)}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn('w-3.5 h-3.5 shrink-0', cfg.color)} />
        <span className={cn('text-xs font-semibold', cfg.color)}>{cfg.label}</span>
        <span className="text-surface-500 text-xs ml-auto">{timeAgo(speech.created_at)}</span>
      </div>
      {speech.speaker && (
        <div className="flex items-center gap-2">
          <Avatar
            src={speech.speaker.avatar_url}
            username={speech.speaker.username}
            size={20}
          />
          <span className="text-xs text-surface-300">
            <Link href={`/profile/${speech.speaker.username}`} className="hover:text-white transition-colors">
              {speech.speaker.display_name ?? speech.speaker.username}
            </Link>
          </span>
        </div>
      )}
      <p className="text-sm text-surface-200 leading-relaxed">{speech.content}</p>
    </motion.div>
  )
}

function ApplicationCard({
  app,
  onSecond,
  onOpenDebate,
  isCurrentUser,
}: {
  app: AdjournmentApplication
  onSecond: (id: string, currently: boolean) => Promise<void>
  onOpenDebate: (app: AdjournmentApplication) => void
  isCurrentUser: boolean
}) {
  const [expanded, setExpanded] = useState(app.status === 'open' || app.status === 'selected')
  const [seconding, setSeconding] = useState(false)

  const cfg = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.pending
  const StatusIcon = cfg.icon
  const catColor = CAT_COLORS[app.category] ?? 'text-surface-400'
  const isOpen = app.status === 'open' || app.status === 'selected'

  async function handleSecond() {
    setSeconding(true)
    try {
      await onSecond(app.id, app.user_has_seconded)
    } finally {
      setSeconding(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border bg-surface-100 overflow-hidden',
        isOpen ? 'border-for-500/40' : 'border-surface-300/40'
      )}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-surface-200/30 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn('text-xs font-semibold flex items-center gap-1', cfg.color)}>
              <StatusIcon className="w-3 h-3" />
              {cfg.label}
            </span>
            <span className={cn('text-xs font-medium', catColor)}>{app.category}</span>
          </div>
          <p className="text-sm font-semibold text-white leading-snug line-clamp-2">{app.title}</p>
          {app.applicant && (
            <p className="text-xs text-surface-400 mt-0.5">
              Raised by {app.applicant.display_name ?? app.applicant.username} · {timeAgo(app.created_at)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1 text-xs text-surface-400">
            <Users className="w-3.5 h-3.5" />
            <span>{app.seconds_count}</span>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-surface-500" /> : <ChevronDown className="w-4 h-4 text-surface-500" />}
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-surface-300/30 pt-3">
              <p className="text-sm text-surface-200 leading-relaxed">{app.issue}</p>

              {/* Speeches */}
              {app.speeches.length > 0 && (
                <div className="space-y-2 mt-3">
                  {app.speeches.map(s => <SpeechCard key={s.id} speech={s} />)}
                </div>
              )}

              {/* Action row */}
              <div className="flex items-center gap-2 pt-1">
                {app.status === 'pending' && !isCurrentUser && (
                  <Button
                    size="sm"
                    variant={app.user_has_seconded ? 'secondary' : 'for'}
                    onClick={handleSecond}
                    disabled={seconding}
                    className="flex items-center gap-1.5"
                  >
                    {seconding ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ThumbsUp className={cn('w-3.5 h-3.5', app.user_has_seconded ? 'text-gold' : '')} />
                    )}
                    {app.user_has_seconded ? 'Seconded' : 'Second'}
                    {app.seconds_count > 0 && (
                      <span className="ml-0.5 opacity-70">· {app.seconds_count}</span>
                    )}
                  </Button>
                )}

                {isOpen && (
                  <Button
                    size="sm"
                    variant="for"
                    onClick={() => onOpenDebate(app)}
                    className="flex items-center gap-1.5"
                  >
                    <Mic2 className="w-3.5 h-3.5" />
                    {app.speeches.length === 0 && app.applicant?.id === undefined
                      ? 'Deliver Opening'
                      : 'Contribute'}
                  </Button>
                )}

                {app.topic_id && (
                  <Link href={`/topic/${app.topic_id}`} className="ml-auto">
                    <Button size="sm" variant="ghost" className="flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />
                      View topic
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Apply Modal ──────────────────────────────────────────────────────────────

function ApplyModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: () => void }) {
  const [title, setTitle] = useState('')
  const [issue, setIssue] = useState('')
  const [category, setCategory] = useState('Politics')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/adjournment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, issue, category }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to submit application')
        return
      }
      onSubmit()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        className="w-full max-w-lg bg-surface-100 rounded-2xl border border-surface-300/40 shadow-2xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-surface-300/30">
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4 text-for-400" />
            <h2 className="text-sm font-semibold text-white">Apply for Adjournment Debate</h2>
          </div>
          <button onClick={onClose} className="text-surface-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-surface-400 leading-relaxed">
            Submit the civic issue you wish to raise. Other citizens can second your application
            to boost its priority in the daily ballot. The most-supported application is called
            for a short debate at the end of sitting.
          </p>

          <div className="space-y-1">
            <label className="text-xs font-medium text-surface-300">Issue title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Underfunding of rural broadband infrastructure"
              maxLength={120}
              required
              className="w-full bg-surface-200 border border-surface-300/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-for-500/60 transition-colors"
            />
            <p className="text-xs text-surface-500 text-right">{title.length}/120</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-surface-300">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full bg-surface-200 border border-surface-300/50 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-for-500/60 transition-colors"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-surface-300">Your statement</label>
            <textarea
              value={issue}
              onChange={e => setIssue(e.target.value)}
              placeholder="Explain the civic issue you want to raise and why it matters. What would you like the government to address? (50–1000 characters)"
              maxLength={1000}
              required
              rows={5}
              className="w-full bg-surface-200 border border-surface-300/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-for-500/60 transition-colors resize-none"
            />
            <p className="text-xs text-surface-500 text-right">{issue.length}/1000</p>
          </div>

          {error && (
            <p className="text-xs text-against-400 bg-against-500/10 border border-against-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="for"
              disabled={submitting || title.length < 10 || issue.length < 50}
              className="flex-1 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
              Submit Application
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Speak Modal ──────────────────────────────────────────────────────────────

function SpeakModal({
  app,
  userId,
  onClose,
  onSubmit,
}: {
  app: AdjournmentApplication
  userId: string | null
  onClose: () => void
  onSubmit: () => void
}) {
  const isApplicant = app.applicant?.id === userId
  const hasOpening = app.speeches.some(s => s.speech_type === 'opening')
  const hasResponse = app.speeches.some(s => s.speech_type === 'response')
  const hasSpoken = app.user_has_spoken

  // Determine what speech types this user can give
  const canOpeningGive = isApplicant && !hasOpening
  const canFloorGive = !isApplicant && !hasSpoken && hasOpening && !hasResponse
  const canResponseGive = !hasResponse && hasOpening

  const defaultType = canOpeningGive ? 'opening' : canFloorGive ? 'floor' : 'response'

  const [speechType, setSpeechType] = useState<'opening' | 'floor' | 'response'>(defaultType)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const maxLen = speechType === 'floor' ? 500 : 1000

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/adjournment/${app.id}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speech_type: speechType, content }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to submit speech')
        return
      }
      onSubmit()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const typeCfg = SPEECH_TYPE_CONFIG[speechType]
  const TypeIcon = typeCfg.icon

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        className="w-full max-w-lg bg-surface-100 rounded-2xl border border-surface-300/40 shadow-2xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-surface-300/30">
          <div className="flex items-center gap-2">
            <Mic2 className="w-4 h-4 text-for-400" />
            <h2 className="text-sm font-semibold text-white">Deliver a Speech</h2>
          </div>
          <button onClick={onClose} className="text-surface-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="text-xs text-surface-400 bg-surface-200 rounded-lg p-3 leading-relaxed">
            <span className="font-medium text-white">{app.title}</span>
            <span className="mx-1.5">·</span>
            <span>{app.category}</span>
          </div>

          {/* Speech type selector */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-surface-300">Speech type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['opening', 'floor', 'response'] as const).map(t => {
                const cfg = SPEECH_TYPE_CONFIG[t]
                const Icon = cfg.icon
                const disabled =
                  (t === 'opening' && !canOpeningGive) ||
                  (t === 'floor' && !canFloorGive) ||
                  (t === 'response' && !canResponseGive)
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSpeechType(t)}
                    className={cn(
                      'rounded-lg border p-2 text-center transition-colors',
                      speechType === t ? `${cfg.border} ${cfg.bg} ${cfg.color}` : 'border-surface-300/40 text-surface-500',
                      disabled && 'opacity-30 cursor-not-allowed'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 mx-auto mb-1" />
                    <span className="text-[10px] font-medium block leading-tight">{cfg.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-surface-300 flex items-center gap-1.5">
              <TypeIcon className={cn('w-3.5 h-3.5', typeCfg.color)} />
              {typeCfg.label}
            </label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value.slice(0, maxLen))}
              placeholder={
                speechType === 'opening'
                  ? 'Deliver your opening statement on the issue you raised...'
                  : speechType === 'floor'
                  ? 'Your contribution to the debate (up to 500 characters)...'
                  : 'Your ministerial response to the debate (up to 1000 characters)...'
              }
              required
              rows={5}
              className="w-full bg-surface-200 border border-surface-300/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-for-500/60 transition-colors resize-none"
            />
            <p className="text-xs text-surface-500 text-right">{content.length}/{maxLen}</p>
          </div>

          {error && (
            <p className="text-xs text-against-400 bg-against-500/10 border border-against-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="for"
              disabled={submitting || content.length < 20}
              className="flex-1 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic2 className="w-4 h-4" />}
              Speak
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = 'live' | 'pending' | 'archive'

export function AdjournmentClient() {
  const router = useRouter()
  const [data, setData] = useState<AdjournmentListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<Tab>('live')
  const [showApply, setShowApply] = useState(false)
  const [speakTarget, setSpeakTarget] = useState<AdjournmentApplication | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Get current user
  useEffect(() => {
    createClient().then(supabase =>
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (mountedRef.current) setUserId(user?.id ?? null)
      })
    )
  }, [])

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const url = tab === 'live'
        ? '/api/adjournment?status=all&limit=20'
        : tab === 'pending'
        ? '/api/adjournment?status=pending&limit=20'
        : '/api/adjournment?status=closed&limit=20'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to load')
      const json: AdjournmentListResponse = await res.json()
      if (mountedRef.current) setData(json)
    } catch {
      // swallow
    } finally {
      if (mountedRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [tab])

  useEffect(() => { load() }, [load])

  // Filter apps by tab
  const apps = data?.applications ?? []

  const liveApps = apps.filter(a => ['open', 'selected'].includes(a.status))
  const pendingApps = apps.filter(a => a.status === 'pending')
  const closedApps = apps.filter(a => a.status === 'closed')

  const displayApps = tab === 'live' ? liveApps : tab === 'pending' ? pendingApps : closedApps

  async function handleSecond(id: string, currentlySeconded: boolean) {
    const res = await fetch(`/api/adjournment/${id}/second`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: currentlySeconded ? 'unsecond' : 'second' }),
    })
    if (res.ok) load(true)
  }

  function handleApplied() {
    setShowApply(false)
    load(true)
  }

  function handleSpoke() {
    setSpeakTarget(null)
    load(true)
  }

  const stats = data?.stats

  return (
    <>
      <div className="relative flex flex-col h-screen bg-surface-50">
        <TopBar />

        <main className="flex-1 overflow-y-auto pb-24">
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

            {/* Header */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Moon className="w-5 h-5 text-for-400" />
                <h1 className="text-xl font-bold text-white tracking-tight">Adjournment Debates</h1>
              </div>
              <p className="text-sm text-surface-400 leading-relaxed max-w-xl">
                At the end of each sitting, any citizen may raise a civic issue for a short formal debate.
                Apply below, gather support from your fellow citizens, and the most-seconded application
                is called for the floor.
              </p>
            </div>

            {/* Stats row */}
            {stats && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Pending', value: stats.pending_count, color: 'text-gold', icon: Clock },
                  { label: 'Live Today', value: stats.open_count, color: 'text-for-400', icon: Mic },
                  { label: 'Applications', value: stats.pending_count + stats.open_count, color: 'text-purple', icon: FileText },
                ].map(({ label, value, color, icon: Icon }) => (
                  <div key={label} className="bg-surface-100 rounded-xl border border-surface-300/30 p-3 text-center">
                    <Icon className={cn('w-4 h-4 mx-auto mb-1', color)} />
                    <p className={cn('text-lg font-bold tabular-nums', color)}>{value}</p>
                    <p className="text-[10px] text-surface-500 uppercase tracking-wide">{label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Apply CTA */}
            <Button
              variant="for"
              onClick={() => {
                if (!userId) { router.push('/login'); return }
                setShowApply(true)
              }}
              className="w-full flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Apply to Raise an Issue
            </Button>

            {/* Tabs */}
            <div className="flex gap-1 bg-surface-100 rounded-xl p-1 border border-surface-300/30">
              {([
                { id: 'live', label: 'Live / Selected', icon: Mic },
                { id: 'pending', label: 'Applications', icon: Clock },
                { id: 'archive', label: 'Archive', icon: FileText },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 px-1 text-xs font-medium transition-all',
                    tab === id
                      ? 'bg-surface-200 text-white shadow-sm'
                      : 'text-surface-400 hover:text-surface-200'
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* Refresh */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-surface-500">
                {displayApps.length} {tab === 'live' ? 'live' : tab === 'pending' ? 'pending' : 'archived'}
              </p>
              <button
                onClick={() => load(true)}
                disabled={refreshing}
                className="text-surface-400 hover:text-white transition-colors"
              >
                <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
              </button>
            </div>

            {/* Content */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="rounded-xl border border-surface-300/30 bg-surface-100 p-4 space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : displayApps.length === 0 ? (
              <EmptyState
                icon={tab === 'live' ? Mic : tab === 'pending' ? Clock : FileText}
                title={
                  tab === 'live'
                    ? 'No debate today'
                    : tab === 'pending'
                    ? 'No pending applications'
                    : 'No past debates'
                }
                description={
                  tab === 'live'
                    ? 'No debate has been selected today yet. Check back after pending applications are balloted.'
                    : tab === 'pending'
                    ? 'Be the first to apply for an adjournment debate on a civic issue that matters to you.'
                    : 'Previous adjournment debates will appear here once concluded.'
                }
                action={
                  tab !== 'archive'
                    ? {
                        label: 'Apply for a Debate',
                        onClick: () => {
                          if (!userId) { router.push('/login'); return }
                          setShowApply(true)
                        },
                      }
                    : undefined
                }
              />
            ) : (
              <div className="space-y-3">
                {displayApps.map(app => (
                  <ApplicationCard
                    key={app.id}
                    app={app}
                    onSecond={handleSecond}
                    onOpenDebate={a => {
                      if (!userId) { router.push('/login'); return }
                      setSpeakTarget(a)
                    }}
                    isCurrentUser={app.applicant?.id === userId}
                  />
                ))}
              </div>
            )}

            {/* Info box */}
            <div className="rounded-xl border border-surface-300/20 bg-surface-100/50 p-4 space-y-2">
              <p className="text-xs font-semibold text-surface-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-gold" />
                How Adjournment Debates Work
              </p>
              <ul className="space-y-1.5 text-xs text-surface-400 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-gold font-bold mt-0.5">1.</span>
                  <span>Any citizen may apply to raise a civic issue for a short debate.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gold font-bold mt-0.5">2.</span>
                  <span>Other citizens can <strong className="text-surface-300">second</strong> applications they support — the most-seconded is selected daily.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gold font-bold mt-0.5">3.</span>
                  <span>Once selected, the applicant delivers an <strong className="text-surface-300">opening speech</strong>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gold font-bold mt-0.5">4.</span>
                  <span>Up to 5 citizens may add <strong className="text-surface-300">floor contributions</strong>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gold font-bold mt-0.5">5.</span>
                  <span>Any citizen may submit a <strong className="text-surface-300">ministerial response</strong> to close the debate.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gold font-bold mt-0.5">6.</span>
                  <span>The complete debate is archived in the <Link href="/hansard" className="text-for-400 hover:text-for-300">Civic Hansard</Link>.</span>
                </li>
              </ul>
            </div>

            {/* Links to related features */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: '/order-paper', label: 'Order Paper', icon: FileText, desc: "Today's business" },
                { href: '/edm', label: 'Early Day Motions', icon: ScrollTextIcon, desc: 'Notices of concern' },
                { href: '/westminster-hall', label: 'Westminster Hall', icon: Gavel, desc: 'Secondary debates' },
                { href: '/hansard', label: 'Hansard', icon: FileText, desc: 'Official record' },
              ].map(({ href, label, icon: Icon, desc }) => (
                <Link key={href} href={href}>
                  <div className="rounded-xl border border-surface-300/20 bg-surface-100/50 p-3 hover:bg-surface-100 transition-colors flex items-start gap-2.5">
                    <Icon className="w-4 h-4 text-surface-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-white">{label}</p>
                      <p className="text-[10px] text-surface-500">{desc}</p>
                    </div>
                    <ArrowRight className="w-3 h-3 text-surface-500 ml-auto mt-0.5 shrink-0" />
                  </div>
                </Link>
              ))}
            </div>

          </div>
        </main>

        <BottomNav />
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showApply && (
          <ApplyModal
            key="apply"
            onClose={() => setShowApply(false)}
            onSubmit={handleApplied}
          />
        )}
        {speakTarget && (
          <SpeakModal
            key={`speak-${speakTarget.id}`}
            app={speakTarget}
            userId={userId}
            onClose={() => setSpeakTarget(null)}
            onSubmit={handleSpoke}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// Inline icon alias to avoid import confusion
function ScrollTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4"/>
      <path d="M19 3H4.5"/>
      <path d="M4 3v14"/>
    </svg>
  )
}
