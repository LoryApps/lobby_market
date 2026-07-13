'use client'

/**
 * /supply-day — The Civic Supply Day
 *
 * Opposition coalitions table formal motions for debate, urgent questions,
 * censures, and divisions. Citizens endorse motions; those that reach the
 * threshold are "granted" and elevated to priority Floor debates.
 *
 * In Westminster, Opposition Days (Supply Days) give minority parties 20
 * sessions per year to choose the topic of debate. This is the civic equivalent.
 *
 * Distinct from:
 *   /pmqs           — question-and-answer with the Prime Minister
 *   /westminster-hall — adjournment debates on specific grievances
 *   /floor          — high-stakes binding votes
 *   /opposition     — general opposition dashboard
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Crown,
  FileText,
  Flag,
  Gavel,
  Landmark,
  Loader2,
  MessageSquare,
  Mic,
  MinusCircle,
  PenLine,
  RefreshCw,
  Scale,
  Swords,
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
import type {
  SupplyDayMotion,
  SupplyDayResponse,
  MotionType,
  MotionStatus,
} from '@/app/api/supply-day/route'

// ─── Motion type config ───────────────────────────────────────────────────────

const MOTION_TYPE_CONFIG: Record<
  MotionType,
  { label: string; shortLabel: string; icon: typeof Scale; color: string; bg: string; border: string; description: string }
> = {
  debate: {
    label: 'Debate Motion',
    shortLabel: 'Debate',
    icon: MessageSquare,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    description: 'Request a full floor debate on the topic',
  },
  urgent_question: {
    label: 'Urgent Question',
    shortLabel: 'Urgent Q',
    icon: Zap,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    description: 'Demand an urgent government statement',
  },
  censure: {
    label: 'Motion of Censure',
    shortLabel: 'Censure',
    icon: AlertTriangle,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    description: 'Formally censure government position',
  },
  division: {
    label: 'Call for Division',
    shortLabel: 'Division',
    icon: Scale,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    description: 'Call for an immediate binding division',
  },
}

// ─── Category colours ─────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/20' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/20' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/20' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/20' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/20' },
  Philosophy:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/20' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/20' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/20' },
  Education:   { text: 'text-for-300',     bg: 'bg-for-500/10',     border: 'border-for-500/20' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/20' },
}

function catColor(cat: string | null) {
  return cat
    ? (CAT_COLOR[cat] ?? { text: 'text-surface-500', bg: 'bg-surface-300/20', border: 'border-surface-400/20' })
    : { text: 'text-surface-500', bg: 'bg-surface-300/20', border: 'border-surface-400/20' }
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
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function timeLeft(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor((diff % 86_400_000) / 3_600_000)
  if (d > 1) return `${d}d left`
  if (d === 1) return `${d}d ${h}h left`
  if (h > 0) return `${h}h left`
  const m = Math.floor((diff % 3_600_000) / 60_000)
  return `${m}m left`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MotionSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-32 rounded-full" />
        <Skeleton className="h-4 w-16 ml-auto" />
      </div>
      <Skeleton className="h-5 w-4/5" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-2 flex-1 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  )
}

// ─── Table Motion Modal ───────────────────────────────────────────────────────

interface TableMotionModalProps {
  coalitionId: string
  onClose: () => void
  onSuccess: () => void
}

function TableMotionModal({ coalitionId, onClose, onSuccess }: TableMotionModalProps) {
  const [motionType, setMotionType] = useState<MotionType>('debate')
  const [title, setTitle] = useState('')
  const [urgency, setUrgency] = useState('')
  const [topicSearch, setTopicSearch] = useState('')
  const [topicResults, setTopicResults] = useState<{ id: string; statement: string; category: string | null; status: string }[]>([])
  const [selectedTopic, setSelectedTopic] = useState<{ id: string; statement: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current)
    if (topicSearch.trim().length < 2) { setTopicResults([]); return }
    searchRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(topicSearch.trim())}&tab=topics`)
        if (res.ok) {
          const { results } = await res.json()
          setTopicResults((results ?? []).slice(0, 5))
        }
      } catch { /* ignore */ }
    }, 350)
    return () => { if (searchRef.current) clearTimeout(searchRef.current) }
  }, [topicSearch])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !urgency.trim()) { setError('Please fill in all required fields.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/supply-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'table',
          coalition_id: coalitionId,
          topic_id: selectedTopic?.id ?? null,
          title: title.trim(),
          urgency_statement: urgency.trim(),
          motion_type: motionType,
        }),
      })
      if (!res.ok) {
        const { error: apiErr } = await res.json()
        setError(apiErr ?? 'Failed to table motion')
        return
      }
      onSuccess()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      aria-modal="true"
      role="dialog"
      aria-label="Table a Supply Day Motion"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.25 }}
        className="relative w-full sm:max-w-lg mx-4 sm:mx-0 bg-surface-100 border border-surface-300 rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[90dvh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-300 flex-shrink-0">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-against-500/10 border border-against-500/20">
            <Flag className="h-4 w-4 text-against-400" aria-hidden />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-mono font-bold text-white">Table a Supply Day Motion</h2>
            <p className="text-xs text-surface-500">Formally challenge the government on a civic issue</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Motion type */}
          <div>
            <label className="block text-xs font-mono text-surface-500 uppercase tracking-wider mb-2">
              Motion Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(MOTION_TYPE_CONFIG) as [MotionType, typeof MOTION_TYPE_CONFIG[MotionType]][]).map(([type, config]) => {
                const Icon = config.icon
                const isSelected = motionType === type
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setMotionType(type)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors',
                      isSelected
                        ? `${config.bg} ${config.border} ${config.color}`
                        : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-300'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                    <span className="text-xs font-mono font-semibold">{config.shortLabel}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-surface-600 mt-1.5 font-mono">
              {MOTION_TYPE_CONFIG[motionType].description}
            </p>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-mono text-surface-500 uppercase tracking-wider mb-2">
              Motion Title <span className="text-against-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="e.g. Urgent debate on the government's housing policy failure"
              className={cn(
                'w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder:text-surface-600',
                'bg-surface-200 border border-surface-300',
                'focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/20',
                'transition-colors'
              )}
            />
            <p className="text-[10px] text-surface-600 mt-1 font-mono text-right">{title.length}/200</p>
          </div>

          {/* Topic (optional) */}
          <div>
            <label className="block text-xs font-mono text-surface-500 uppercase tracking-wider mb-2">
              Related Topic <span className="text-surface-600">(optional)</span>
            </label>
            {selectedTopic ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-for-500/10 border border-for-500/30">
                <FileText className="h-3.5 w-3.5 text-for-400 flex-shrink-0" aria-hidden />
                <span className="text-sm text-for-300 flex-1 line-clamp-1">{selectedTopic.statement}</span>
                <button
                  type="button"
                  onClick={() => { setSelectedTopic(null); setTopicSearch('') }}
                  className="h-5 w-5 rounded flex items-center justify-center text-surface-500 hover:text-white transition-colors"
                  aria-label="Remove topic"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={topicSearch}
                  onChange={(e) => setTopicSearch(e.target.value)}
                  placeholder="Search for a topic..."
                  className={cn(
                    'w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder:text-surface-600',
                    'bg-surface-200 border border-surface-300',
                    'focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/20',
                    'transition-colors'
                  )}
                />
                {topicResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-surface-100 border border-surface-300 rounded-xl shadow-xl overflow-hidden">
                    {topicResults.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { setSelectedTopic({ id: t.id, statement: t.statement }); setTopicSearch(''); setTopicResults([]) }}
                        className="w-full text-left px-3 py-2.5 text-sm text-surface-400 hover:text-white hover:bg-surface-200 transition-colors border-b border-surface-300 last:border-0 line-clamp-1"
                      >
                        {t.statement}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Urgency statement */}
          <div>
            <label className="block text-xs font-mono text-surface-500 uppercase tracking-wider mb-2">
              Statement of Urgency <span className="text-against-400">*</span>
            </label>
            <textarea
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
              maxLength={2000}
              rows={5}
              placeholder="Set out why this matter requires immediate parliamentary attention. Reference specific government failures, policy gaps, or civic harms. Aim for clarity and specificity — vague motions attract fewer endorsements."
              className={cn(
                'w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder:text-surface-600',
                'bg-surface-200 border border-surface-300 resize-none',
                'focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/20',
                'transition-colors leading-relaxed'
              )}
            />
            <p className="text-[10px] text-surface-600 mt-1 font-mono text-right">{urgency.length}/2000</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-against-500/10 border border-against-500/20 text-against-400 text-sm font-mono">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-surface-300 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="supply-day-form"
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || urgency.trim().length < 30}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono font-semibold transition-all',
              'bg-against-600/30 border border-against-500/50 text-against-300',
              'hover:bg-against-600/50 hover:text-white',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className="h-3.5 w-3.5" />}
            {submitting ? 'Tabling…' : 'Table Motion'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Motion Card ──────────────────────────────────────────────────────────────

interface MotionCardProps {
  motion: SupplyDayMotion
  onEndorse: (id: string, currently: boolean) => Promise<void>
  endorsingId: string | null
}

function MotionCard({ motion, onEndorse, endorsingId }: MotionCardProps) {
  const [expanded, setExpanded] = useState(false)
  const config = MOTION_TYPE_CONFIG[motion.motion_type]
  const Icon = config.icon

  const pct = Math.min(Math.round((motion.endorsement_count / motion.endorsement_target) * 100), 100)
  const isGranted = motion.status === 'granted'
  const isExpired = new Date(motion.closes_at).getTime() < Date.now()
  const isActive = motion.status === 'tabled' && !isExpired
  const topic = motion.topic
  const topicCat = catColor(topic?.category ?? null)
  const isBusy = endorsingId === motion.id

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border overflow-hidden transition-colors',
        isGranted
          ? 'bg-emerald/5 border-emerald/30'
          : motion.status === 'denied'
          ? 'bg-against-500/5 border-against-500/20'
          : motion.status === 'withdrawn'
          ? 'bg-surface-100 border-surface-300 opacity-60'
          : 'bg-surface-100 border-surface-300'
      )}
    >
      <div className="p-5">
        {/* Row 1: type badge + status + time */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold border flex-shrink-0',
              config.bg, config.border, config.color
            )}
          >
            <Icon className="h-2.5 w-2.5" aria-hidden />
            {config.shortLabel}
          </span>

          {isGranted && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald/10 border border-emerald/30 text-emerald flex-shrink-0">
              <CheckCircle2 className="h-2.5 w-2.5" />
              Granted
            </span>
          )}

          {motion.status === 'denied' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-against-500/10 border border-against-500/30 text-against-400 flex-shrink-0">
              <MinusCircle className="h-2.5 w-2.5" />
              Denied
            </span>
          )}

          {motion.status === 'withdrawn' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-surface-300/20 border border-surface-400/20 text-surface-600 flex-shrink-0">
              Withdrawn
            </span>
          )}

          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {isActive && (
              <span className="text-[11px] font-mono text-surface-500 flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                {timeLeft(motion.closes_at)}
              </span>
            )}
            <span className="text-[11px] font-mono text-surface-600">
              {relativeTime(motion.created_at)}
            </span>
          </div>
        </div>

        {/* Row 2: coalition */}
        {motion.coalition && (
          <div className="flex items-center gap-2 mb-3">
            <div
              className="h-5 w-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white"
              style={{ background: motion.coalition.badge_color ?? '#3b4e6e' }}
              aria-hidden
            >
              {motion.coalition.name.slice(0, 1).toUpperCase()}
            </div>
            <Link
              href={`/coalition/${motion.coalition.slug}`}
              className="text-xs font-mono text-surface-400 hover:text-white transition-colors truncate"
            >
              {motion.coalition.name}
            </Link>
            <span className="text-surface-600 text-xs">·</span>
            <span className="text-[11px] font-mono text-surface-600">
              {motion.coalition.member_count} members
            </span>
            {motion.tabled_by && (
              <>
                <span className="text-surface-600 text-xs">·</span>
                <div className="flex items-center gap-1 min-w-0">
                  <Avatar
                    src={motion.tabled_by.avatar_url}
                    fallback={motion.tabled_by.display_name || motion.tabled_by.username}
                    size="xs"
                  />
                  <Link
                    href={`/profile/${motion.tabled_by.username}`}
                    className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors truncate"
                  >
                    {motion.tabled_by.display_name || motion.tabled_by.username}
                  </Link>
                </div>
              </>
            )}
          </div>
        )}

        {/* Row 3: title */}
        <h3 className="text-sm font-semibold text-white mb-2 leading-snug">
          {motion.title}
        </h3>

        {/* Row 4: topic */}
        {topic && (
          <Link
            href={`/topic/${topic.id}`}
            className={cn(
              'flex items-start gap-2 p-2.5 rounded-xl border mb-3 group',
              topicCat.bg, topicCat.border
            )}
          >
            <FileText className={cn('h-3.5 w-3.5 flex-shrink-0 mt-0.5', topicCat.text)} aria-hidden />
            <div className="flex-1 min-w-0">
              <p className={cn('text-xs font-mono line-clamp-1 group-hover:text-white transition-colors', topicCat.text)}>
                {topic.statement}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {topic.category && (
                  <span className="text-[10px] text-surface-600">{topic.category}</span>
                )}
                <div className="flex-1 h-1 bg-surface-300 rounded-full overflow-hidden max-w-[80px]">
                  <div className="h-full bg-for-500 rounded-full" style={{ width: `${Math.round(topic.blue_pct)}%` }} />
                </div>
                <span className="text-[10px] font-mono text-for-400">{Math.round(topic.blue_pct)}%</span>
                <span className="text-[10px] font-mono text-against-400">{Math.round(100 - topic.blue_pct)}%</span>
              </div>
            </div>
            <ChevronRight className={cn('h-3.5 w-3.5 flex-shrink-0', topicCat.text)} aria-hidden />
          </Link>
        )}

        {/* Row 5: urgency statement (collapsible) */}
        <div className="mb-4">
          <p
            className={cn(
              'text-xs text-surface-400 leading-relaxed font-mono',
              !expanded && 'line-clamp-3'
            )}
          >
            {motion.urgency_statement}
          </p>
          {motion.urgency_statement.length > 200 && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors mt-1 flex items-center gap-1"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Show less' : 'Read full statement'}
            </button>
          )}
        </div>

        {/* Row 6: endorsement progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-mono text-surface-500">
              {motion.endorsement_count.toLocaleString()} / {motion.endorsement_target.toLocaleString()} endorsements
            </span>
            <span className={cn('text-[11px] font-mono font-bold', pct >= 100 ? 'text-emerald' : 'text-surface-500')}>
              {pct}%
            </span>
          </div>
          <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                pct >= 100 ? 'bg-emerald' : 'bg-for-500'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Row 7: endorse button */}
        {isActive && (
          <button
            onClick={() => onEndorse(motion.id, motion.user_endorsed)}
            disabled={isBusy}
            aria-label={motion.user_endorsed ? 'Withdraw endorsement' : 'Endorse this motion'}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-mono font-semibold',
              'border transition-all duration-150 disabled:opacity-50',
              motion.user_endorsed
                ? 'bg-for-600/20 border-for-600/50 text-for-300 hover:bg-against-500/10 hover:border-against-500/30 hover:text-against-400'
                : 'bg-surface-200 border-surface-300 text-white hover:bg-for-600/30 hover:border-for-500/50 hover:text-for-300'
            )}
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : motion.user_endorsed ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Endorsed — click to withdraw
              </>
            ) : (
              <>
                <PenLine className="h-4 w-4" />
                Sign this motion
              </>
            )}
          </button>
        )}

        {/* Government response */}
        {motion.government_response && (
          <div className="mt-4 rounded-xl bg-gold/5 border border-gold/20 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="h-3.5 w-3.5 text-gold flex-shrink-0" aria-hidden />
              <span className="text-xs font-mono font-bold text-gold uppercase tracking-wider">
                Government Response
              </span>
              {motion.responded_at && (
                <span className="text-[11px] font-mono text-surface-600 ml-auto">
                  {relativeTime(motion.responded_at)}
                </span>
              )}
            </div>
            {motion.responded_by_profile && (
              <div className="flex items-center gap-1.5 mb-2">
                <Avatar
                  src={motion.responded_by_profile.avatar_url}
                  fallback={motion.responded_by_profile.display_name || motion.responded_by_profile.username}
                  size="xs"
                />
                <Link
                  href={`/profile/${motion.responded_by_profile.username}`}
                  className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                >
                  {motion.responded_by_profile.display_name || motion.responded_by_profile.username}
                </Link>
              </div>
            )}
            <p className="text-xs text-surface-400 font-mono leading-relaxed">
              {motion.government_response}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

type FilterStatus = 'active' | 'granted' | 'historical'
type FilterType = 'all' | MotionType

export function SupplyDayClient() {
  const [data, setData] = useState<SupplyDayResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('active')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [endorsingId, setEndorsingId] = useState<string | null>(null)
  const [showTableModal, setShowTableModal] = useState(false)

  const statusParam: Record<FilterStatus, string> = {
    active:     'tabled',
    granted:    'granted',
    historical: 'denied,withdrawn',
  }

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const params = new URLSearchParams({ status: statusParam[filterStatus] })
      if (filterType !== 'all') params.set('type', filterType)
      const res = await fetch(`/api/supply-day?${params.toString()}`)
      if (res.ok) {
        setData(await res.json())
      }
    } catch { /* ignore */ }
    finally {
      setLoading(false)
      setRefreshing(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterType])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleEndorse(motionId: string, currentlyEndorsed: boolean) {
    if (endorsingId) return
    setEndorsingId(motionId)
    try {
      const action = currentlyEndorsed ? 'withdraw_endorsement' : 'endorse'
      const res = await fetch('/api/supply-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, motion_id: motionId }),
      })
      if (res.ok) {
        setData((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            motions: prev.motions.map((m) => {
              if (m.id !== motionId) return m
              const delta = currentlyEndorsed ? -1 : 1
              const newCount = Math.max(0, m.endorsement_count + delta)
              const newStatus: MotionStatus =
                !currentlyEndorsed && newCount >= m.endorsement_target ? 'granted' : m.status
              return {
                ...m,
                endorsement_count: newCount,
                user_endorsed: !currentlyEndorsed,
                status: newStatus,
              }
            }),
          }
        })
      }
    } catch { /* ignore */ }
    finally {
      setEndorsingId(null)
    }
  }

  const motions = data?.motions ?? []
  const stats = data?.stats

  const STATUS_TABS: { id: FilterStatus; label: string }[] = [
    { id: 'active',     label: 'Active' },
    { id: 'granted',    label: 'Granted' },
    { id: 'historical', label: 'Historical' },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="mb-6">
          <Link
            href="/opposition"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Opposition
          </Link>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
                <Flag className="h-5 w-5 text-against-400" aria-hidden />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">Supply Day</h1>
                <p className="text-xs font-mono text-surface-500 mt-0.5">
                  Opposition motions for debate · civic challenge proceedings
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchData(true)}
                disabled={refreshing}
                aria-label="Refresh motions"
                className={cn(
                  'flex items-center justify-center h-9 w-9 rounded-lg',
                  'bg-surface-200 border border-surface-300 text-surface-500',
                  'hover:bg-surface-300 hover:text-white transition-colors',
                  'disabled:opacity-50'
                )}
              >
                <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              </button>

              {data?.user_coalition_id && (
                <button
                  onClick={() => setShowTableModal(true)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono font-semibold',
                    'bg-against-600/20 border border-against-500/40 text-against-300',
                    'hover:bg-against-600/35 hover:text-white transition-colors'
                  )}
                >
                  <Flag className="h-3.5 w-3.5" />
                  Table Motion
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Context banner ───────────────────────────────────────────── */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 mb-6 flex items-start gap-3">
          <Landmark className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" aria-hidden />
          <p className="text-xs font-mono text-surface-500 leading-relaxed">
            Supply Days give the opposition the right to set the parliamentary agenda.
            Table a motion, rally civic support, and force the government to respond.
            Motions that reach their endorsement threshold are granted formal debate time on The Floor.
          </p>
        </div>

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center">
              <p className="text-2xl font-mono font-bold text-white">{stats.active_motions}</p>
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-1">Active</p>
            </div>
            <div className="rounded-xl bg-surface-100 border border-emerald/25 p-4 text-center">
              <p className="text-2xl font-mono font-bold text-emerald">{stats.granted_motions}</p>
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-1">Granted</p>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center">
              <p className="text-2xl font-mono font-bold text-white">{stats.total_endorsements.toLocaleString()}</p>
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-1">Endorsements</p>
            </div>
          </div>
        )}

        {/* ── Status tabs ───────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 bg-surface-200 rounded-xl mb-4" role="tablist" aria-label="Filter by status">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={filterStatus === tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={cn(
                'flex-1 h-8 rounded-lg text-xs font-mono font-semibold transition-colors',
                filterStatus === tab.id
                  ? 'bg-surface-100 text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Motion type filter ────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap mb-6">
          <button
            onClick={() => setFilterType('all')}
            className={cn(
              'px-3 py-1 rounded-lg border text-xs font-mono transition-colors',
              filterType === 'all'
                ? 'bg-surface-300 border-surface-400 text-white'
                : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-300'
            )}
          >
            All
          </button>
          {(Object.entries(MOTION_TYPE_CONFIG) as [MotionType, typeof MOTION_TYPE_CONFIG[MotionType]][]).map(([type, config]) => {
            const Icon = config.icon
            return (
              <button
                key={type}
                onClick={() => setFilterType(filterType === type ? 'all' : type)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-mono transition-colors',
                  filterType === type
                    ? `${config.bg} ${config.border} ${config.color}`
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-300'
                )}
              >
                <Icon className="h-3 w-3" aria-hidden />
                {config.shortLabel}
              </button>
            )
          })}
        </div>

        {/* ── Motion list ───────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <MotionSkeleton key={i} />)}
          </div>
        ) : motions.length === 0 ? (
          <EmptyState
            icon={Flag}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/20"
            title={filterStatus === 'active' ? 'No active motions' : filterStatus === 'granted' ? 'No granted motions' : 'No historical motions'}
            description={
              filterStatus === 'active'
                ? data?.user_coalition_id
                  ? 'Be the first to table a Supply Day motion and hold the government to account.'
                  : 'No opposition motions are currently tabled. Join a coalition to table your own.'
                : 'Nothing to show here yet.'
            }
            action={
              data?.user_coalition_id
                ? {
                    label: 'Table a motion',
                    onClick: () => setShowTableModal(true),
                    icon: Flag,
                  }
                : { label: 'Find a coalition', href: '/coalitions', icon: Users }
            }
          />
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {motions.map((motion) => (
                <MotionCard
                  key={motion.id}
                  motion={motion}
                  onEndorse={handleEndorse}
                  endorsingId={endorsingId}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* ── Parliamentary links ───────────────────────────────────────── */}
        <div className="mt-8 rounded-xl bg-surface-100 border border-surface-300 overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-300">
            <p className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
              Parliamentary Proceedings
            </p>
          </div>
          <div className="divide-y divide-surface-300">
            {[
              { href: '/pmqs', icon: Mic, label: "Prime Minister's Questions", sub: 'Weekly Q&A with the PM' },
              { href: '/westminster-hall', icon: Landmark, label: 'Westminster Hall', sub: 'Adjournment debates on grievances' },
              { href: '/floor', icon: Gavel, label: 'The Floor', sub: 'High-stakes binding votes' },
              { href: '/opposition', icon: Swords, label: 'HM Official Opposition', sub: 'Counter-government programme' },
              { href: '/kings-speech', icon: Crown, label: "The King's Speech", sub: 'Government legislative programme' },
            ].map(({ href, icon: NavIcon, label, sub }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-200 transition-colors group"
              >
                <NavIcon className="h-4 w-4 text-surface-500 group-hover:text-white flex-shrink-0 transition-colors" aria-hidden />
                <div className="flex-1">
                  <p className="text-sm text-white group-hover:text-for-400 transition-colors">{label}</p>
                  <p className="text-xs text-surface-600">{sub}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-white transition-colors" aria-hidden />
              </Link>
            ))}
          </div>
        </div>

      </main>
      <BottomNav />

      {/* Table motion modal */}
      <AnimatePresence>
        {showTableModal && data?.user_coalition_id && (
          <TableMotionModal
            coalitionId={data.user_coalition_id}
            onClose={() => setShowTableModal(false)}
            onSuccess={() => {
              setShowTableModal(false)
              fetchData(true)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
