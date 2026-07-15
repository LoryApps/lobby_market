'use client'

/**
 * /emergency-debates — Standing Order 24 Emergency Debates
 *
 * Any citizen can apply for an emergency debate on any urgent civic matter.
 * Other citizens "second" the proposal; 10+ seconds auto-grant it.
 * The Speaker (Elder) may also grant or deny manually.
 * Granted debates create a timed debate room visible site-wide.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileText,
  Gavel,
  Info,
  Loader2,
  Mic,
  Plus,
  RefreshCw,
  Scale,
  Search,
  ThumbsUp,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  EmergencyDebate,
  EmergencyDebatesResponse,
} from '@/app/api/emergency-debates/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'expired'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m remaining`
  return `${m}m remaining`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  EmergencyDebate['status'],
  { label: string; color: string; bg: string; border: string; icon: typeof Zap }
> = {
  proposed: {
    label: 'Awaiting Endorsements',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    icon: Clock,
  },
  granted: {
    label: 'GRANTED',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    icon: CheckCircle2,
  },
  denied: {
    label: 'Denied',
    color: 'text-surface-500',
    bg: 'bg-surface-300/20',
    border: 'border-surface-400/20',
    icon: XCircle,
  },
  expired: {
    label: 'Expired',
    color: 'text-surface-600',
    bg: 'bg-surface-300/10',
    border: 'border-surface-500/20',
    icon: Clock,
  },
  concluded: {
    label: 'Concluded',
    color: 'text-for-400',
    bg: 'bg-for-900/20',
    border: 'border-for-700/30',
    icon: Gavel,
  },
}

// ─── Endorsement bar ──────────────────────────────────────────────────────────

function EndorsementBar({
  count,
  target,
}: {
  count: number
  target: number
}) {
  const pct = Math.min(100, Math.round((count / target) * 100))
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-surface-500">
          <span className="text-white font-bold">{count}</span> / {target} endorsements
        </span>
        <span className={pct >= 100 ? 'text-emerald' : 'text-gold'}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-surface-300/50 rounded-full overflow-hidden">
        <motion.div
          className={cn(
            'h-full rounded-full',
            pct >= 100 ? 'bg-emerald' : 'bg-gold',
          )}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ─── Debate card ──────────────────────────────────────────────────────────────

function DebateCard({
  debate,
  onEndorse,
  endorsing,
}: {
  debate: EmergencyDebate
  onEndorse: (id: string) => void
  endorsing: Set<string>
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg = STATUS_CONFIG[debate.status]
  const StatusIcon = cfg.icon
  const isEndorsing = endorsing.has(debate.id)
  const isActive = debate.status === 'proposed'
  const isGranted = debate.status === 'granted'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-4 sm:p-5 space-y-3 transition-colors',
        isGranted
          ? 'bg-emerald/5 border-emerald/20'
          : isActive
          ? 'bg-surface-100 border-surface-300/60'
          : 'bg-surface-100/50 border-surface-300/40',
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <Avatar
          src={debate.proposer.avatar_url}
          fallback={debate.proposer.display_name || debate.proposer.username}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Link
              href={`/profile/${debate.proposer.username}`}
              className="text-xs font-semibold text-white hover:text-for-300 transition-colors"
            >
              {debate.proposer.display_name || debate.proposer.username}
            </Link>
            <span className="text-[11px] text-surface-500 font-mono">
              {timeAgo(debate.proposed_at)}
            </span>
            {/* Status pill */}
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                cfg.color, cfg.bg, cfg.border,
              )}
            >
              <StatusIcon className="h-2.5 w-2.5" />
              {cfg.label}
            </span>
          </div>

          {/* Title */}
          <h3 className={cn(
            'font-semibold text-sm leading-snug',
            isActive || isGranted ? 'text-white' : 'text-surface-400',
          )}>
            {debate.title}
          </h3>

          {/* Linked topic */}
          {debate.topic && (
            <Link
              href={`/topic/${debate.topic.id}`}
              className="inline-flex items-center gap-1 mt-1 text-[11px] text-for-400 hover:text-for-300 transition-colors"
            >
              <FileText className="h-3 w-3" />
              {debate.topic.statement.slice(0, 60)}
              {debate.topic.statement.length > 60 ? '…' : ''}
              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
            </Link>
          )}
        </div>
      </div>

      {/* Urgency statement (expandable) */}
      <div>
        <p className={cn(
          'text-xs text-surface-400 leading-relaxed',
          !expanded && 'line-clamp-2',
        )}>
          {debate.urgency_statement}
        </p>
        {debate.urgency_statement.length > 120 && (
          <button
            onClick={() => setExpanded((x) => !x)}
            className="mt-1 flex items-center gap-1 text-[11px] text-surface-500 hover:text-surface-300 transition-colors"
          >
            {expanded ? (
              <><ChevronUp className="h-3 w-3" />Show less</>
            ) : (
              <><ChevronDown className="h-3 w-3" />Read more</>
            )}
          </button>
        )}
      </div>

      {/* Speaker decision */}
      {debate.speaker_decision && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-surface-200/60 border border-surface-300/60">
          <Gavel className="h-3.5 w-3.5 text-gold mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-surface-300 leading-relaxed">
            <span className="text-gold font-semibold">Speaker: </span>
            {debate.speaker_decision}
          </p>
        </div>
      )}

      {/* Endorsement bar (proposed debates) */}
      {isActive && (
        <EndorsementBar
          count={debate.endorsement_count}
          target={debate.endorsement_target}
        />
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-1">
        {/* Expires / time info */}
        <div className="flex items-center gap-1.5 text-[11px] text-surface-500 font-mono">
          <Clock className="h-3 w-3" />
          {isActive ? timeUntil(debate.expires_at) : null}
          {isGranted && debate.debate_id ? 'Debate in progress' : null}
          {!isActive && !isGranted ? '' : null}
        </div>

        {/* Right side: endorse button OR link to debate */}
        {isGranted && debate.debate_id ? (
          <Link
            href={`/debate/${debate.debate_id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald/20 border border-emerald/30 text-emerald text-xs font-semibold hover:bg-emerald/30 transition-colors"
          >
            <Mic className="h-3.5 w-3.5" />
            Join Debate
            <ArrowRight className="h-3 w-3" />
          </Link>
        ) : isActive ? (
          <button
            onClick={() => onEndorse(debate.id)}
            disabled={isEndorsing}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
              debate.user_endorsed
                ? 'bg-for-600/20 border-for-600/40 text-for-400 hover:bg-for-600/10'
                : 'bg-purple/80 border-purple/50 text-white hover:bg-purple',
              isEndorsing && 'opacity-50 cursor-not-allowed',
            )}
          >
            {isEndorsing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ThumbsUp className="h-3.5 w-3.5" />
            )}
            {debate.user_endorsed ? 'Endorsed' : 'Endorse'}
          </button>
        ) : null}
      </div>
    </motion.div>
  )
}

// ─── Propose modal ────────────────────────────────────────────────────────────

interface ProposeModalProps {
  onClose: () => void
  onSubmit: (title: string, urgency: string, topicId?: string) => Promise<void>
  submitting: boolean
}

function ProposeModal({ onClose, onSubmit, submitting }: ProposeModalProps) {
  const [title, setTitle] = useState('')
  const [urgency, setUrgency] = useState('')
  const [topicQuery, setTopicQuery] = useState('')
  const [topicResults, setTopicResults] = useState<
    Array<{ id: string; statement: string; category: string | null }>
  >([])
  const [selectedTopic, setSelectedTopic] = useState<{
    id: string
    statement: string
  } | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!topicQuery.trim() || topicQuery.length < 3) {
      setTopicResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(topicQuery)}&type=topics&limit=5`,
        )
        if (!res.ok) return
        const data = await res.json()
        setTopicResults(data.topics ?? [])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [topicQuery])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await onSubmit(title, urgency, selectedTopic?.id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit proposal')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="relative w-full max-w-lg bg-surface-100 border border-surface-300 rounded-2xl p-5 sm:p-6 space-y-4 z-10"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-gold" />
            <h2 className="font-semibold text-white text-sm">Propose Emergency Debate</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-200 transition-colors">
            <X className="h-4 w-4 text-surface-500" />
          </button>
        </div>

        <div className="p-3 rounded-xl bg-gold/10 border border-gold/20 flex items-start gap-2">
          <Info className="h-3.5 w-3.5 text-gold mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-gold/80 leading-relaxed">
            An emergency debate must concern a specific matter of urgent civic importance.
            You may propose one per 24 hours. Gather 10 endorsements and the Speaker will
            grant the debate automatically.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-surface-400 mb-1.5">
              Matter for Debate
              <span className="text-against-400 ml-1">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The immediate threat to civic infrastructure from recent policy changes"
              maxLength={200}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-200 border border-surface-300/60 text-white text-sm placeholder:text-surface-600 focus:outline-none focus:border-gold/40 focus:bg-surface-200 transition-colors"
            />
            <div className="flex justify-end mt-1">
              <span className="text-[10px] text-surface-600 font-mono">{title.length}/200</span>
            </div>
          </div>

          {/* Urgency statement */}
          <div>
            <label className="block text-xs font-semibold text-surface-400 mb-1.5">
              Urgency Statement
              <span className="text-against-400 ml-1">*</span>
            </label>
            <textarea
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
              placeholder="Explain why this matter is urgent and cannot wait for the normal legislative process..."
              maxLength={1000}
              rows={4}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-200 border border-surface-300/60 text-white text-sm placeholder:text-surface-600 focus:outline-none focus:border-gold/40 focus:bg-surface-200 transition-colors resize-none"
            />
            <div className="flex justify-between mt-1">
              <span className={cn(
                'text-[10px] font-mono',
                urgency.length < 50 ? 'text-against-400' : 'text-surface-600',
              )}>
                {urgency.length < 50 ? `${50 - urgency.length} more characters required` : ''}
              </span>
              <span className="text-[10px] text-surface-600 font-mono">{urgency.length}/1000</span>
            </div>
          </div>

          {/* Optional topic link */}
          <div>
            <label className="block text-xs font-semibold text-surface-400 mb-1.5">
              Linked Topic <span className="text-surface-600 font-normal">(optional)</span>
            </label>
            {selectedTopic ? (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-for-900/20 border border-for-700/30">
                <FileText className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
                <p className="text-xs text-for-300 flex-1 min-w-0 truncate">{selectedTopic.statement}</p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTopic(null)
                    setTopicQuery('')
                  }}
                  className="p-1 rounded hover:bg-surface-300/30 transition-colors"
                >
                  <X className="h-3.5 w-3.5 text-surface-500" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500" />
                <input
                  value={topicQuery}
                  onChange={(e) => setTopicQuery(e.target.value)}
                  placeholder="Search for a related topic..."
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-surface-200 border border-surface-300/60 text-white text-sm placeholder:text-surface-600 focus:outline-none focus:border-for-500/40 focus:bg-surface-200 transition-colors"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 animate-spin" />
                )}
                {topicResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-surface-100 border border-surface-300 rounded-xl shadow-xl z-20 overflow-hidden">
                    {topicResults.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setSelectedTopic({ id: t.id, statement: t.statement })
                          setTopicQuery('')
                          setTopicResults([])
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-surface-200 transition-colors border-b border-surface-300/40 last:border-0"
                      >
                        <p className="text-xs text-white truncate">{t.statement}</p>
                        {t.category && (
                          <p className="text-[10px] text-surface-500 mt-0.5">{t.category}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-against-900/20 border border-against-700/30">
              <AlertTriangle className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
              <p className="text-xs text-against-300">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-surface-200 border border-surface-300/60 text-surface-400 text-sm font-semibold hover:bg-surface-300/60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || title.trim().length < 10 || urgency.trim().length < 50}
              className="flex-1 py-2.5 rounded-xl bg-gold/80 border border-gold/50 text-black text-sm font-bold hover:bg-gold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              Propose Debate
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'proposed' | 'granted' | 'concluded'

const FILTER_TABS: { id: FilterTab; label: string; icon: typeof Zap }[] = [
  { id: 'all',       label: 'All',       icon: Scale },
  { id: 'proposed',  label: 'Proposed',  icon: Clock },
  { id: 'granted',   label: 'Granted',   icon: CheckCircle2 },
  { id: 'concluded', label: 'Concluded', icon: Gavel },
]

export function EmergencyDebatesClient() {
  const [data, setData] = useState<EmergencyDebatesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [endorsing, setEndorsing] = useState(new Set<string>())
  const [showPropose, setShowPropose] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/emergency-debates')
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as EmergencyDebatesResponse
      setData(json)
    } catch {
      setError('Could not load emergency debates. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleEndorse = useCallback(async (id: string) => {
    setEndorsing((s) => new Set([...s, id]))
    try {
      const res = await fetch(`/api/emergency-debates/${id}/endorse`, { method: 'POST' })
      if (!res.ok) return
      const json = await res.json() as { endorsed: boolean; endorsement_count: number }
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          debates: prev.debates.map((d) =>
            d.id === id
              ? {
                  ...d,
                  user_endorsed: json.endorsed,
                  endorsement_count: json.endorsement_count,
                  status:
                    json.endorsement_count >= d.endorsement_target
                      ? 'granted'
                      : d.status,
                }
              : d
          ),
        }
      })
    } finally {
      setEndorsing((s) => {
        const next = new Set(s)
        next.delete(id)
        return next
      })
    }
  }, [])

  const handlePropose = useCallback(async (title: string, urgency: string, topicId?: string) => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/emergency-debates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, urgency_statement: urgency, topic_id: topicId ?? null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to propose debate')
      setShowPropose(false)
      await load()
    } finally {
      setSubmitting(false)
    }
  }, [load])

  const filtered =
    filter === 'all'
      ? data?.debates ?? []
      : (data?.debates ?? []).filter((d) =>
          filter === 'proposed'
            ? d.status === 'proposed'
            : filter === 'granted'
            ? d.status === 'granted'
            : d.status === 'concluded',
        )

  const grantedDebates = (data?.debates ?? []).filter((d) => d.status === 'granted')

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-16 pb-28">
        {/* Header */}
        <div className="pt-6 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-gold" />
            <h1 className="font-mono font-bold text-xl text-white">Emergency Debates</h1>
            <Badge variant="proposed" className="font-mono text-[10px]">SO24</Badge>
          </div>
          <p className="text-sm text-surface-500 leading-relaxed">
            Citizens may apply to the Speaker for an emergency debate on any matter of urgent
            public importance. Gather 10 endorsements — and the chamber convenes immediately.
          </p>
        </div>

        {/* Active granted debates banner */}
        {grantedDebates.length > 0 && (
          <div className="mb-5 p-4 rounded-2xl bg-emerald/10 border border-emerald/30 space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald animate-pulse" />
              <p className="text-sm font-semibold text-emerald">
                {grantedDebates.length} emergency debate{grantedDebates.length > 1 ? 's' : ''} in progress
              </p>
            </div>
            {grantedDebates.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3">
                <p className="text-xs text-white truncate flex-1">{d.title}</p>
                {d.debate_id && (
                  <Link
                    href={`/debate/${d.debate_id}`}
                    className="flex-shrink-0 text-[11px] text-emerald font-semibold hover:text-emerald/80 transition-colors flex items-center gap-1"
                  >
                    Join <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions row */}
        <div className="flex items-center justify-between mb-4">
          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-surface-200/60 rounded-xl p-1 border border-surface-300/40">
            {FILTER_TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all',
                    filter === tab.id
                      ? 'bg-surface-300 text-white shadow'
                      : 'text-surface-500 hover:text-surface-300',
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Propose + Refresh */}
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="p-2 rounded-xl bg-surface-200/60 border border-surface-300/40 text-surface-400 hover:text-surface-200 transition-colors"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
            <button
              onClick={() => setShowPropose(true)}
              disabled={data?.userProposalToday}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors',
                data?.userProposalToday
                  ? 'bg-surface-200/40 border-surface-400/20 text-surface-600 cursor-not-allowed'
                  : 'bg-gold/80 border-gold/50 text-black hover:bg-gold',
              )}
              title={data?.userProposalToday ? 'You have already proposed a debate today' : undefined}
            >
              <Plus className="h-3.5 w-3.5" />
              Propose
            </button>
          </div>
        </div>

        {/* Rate limit notice */}
        {data?.userProposalToday && (
          <div className="mb-3 p-2.5 rounded-xl bg-surface-200/40 border border-surface-300/30 flex items-center gap-2">
            <Info className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
            <p className="text-[11px] text-surface-500">
              You have already proposed a debate today. You may propose again after 24 hours.
            </p>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-surface-300/40 p-4 space-y-3">
                <div className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 p-4 rounded-2xl bg-against-900/20 border border-against-700/30">
            <AlertTriangle className="h-4 w-4 text-against-400" />
            <p className="text-sm text-against-300">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<AlertTriangle className="h-8 w-8 text-gold/40" />}
            title={
              filter === 'all'
                ? 'No emergency debates'
                : `No ${filter} debates`
            }
            description={
              filter === 'all'
                ? 'No emergency debates have been proposed yet. Be the first to raise an urgent matter with the Speaker.'
                : `No debates in this category right now.`
            }
            action={
              !data?.userProposalToday
                ? {
                    label: 'Propose a Debate',
                    onClick: () => setShowPropose(true),
                  }
                : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filtered.map((debate) => (
                <DebateCard
                  key={debate.id}
                  debate={debate}
                  onEndorse={handleEndorse}
                  endorsing={endorsing}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* How it works */}
        <div className="mt-8 pt-6 border-t border-surface-300/40">
          <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Users className="h-3.5 w-3.5" />
            How it works
          </h3>
          <ol className="space-y-2.5">
            {[
              {
                step: '1',
                text: 'Any citizen may propose one emergency debate per 24 hours — stating the matter and why it is urgent.',
              },
              {
                step: '2',
                text: 'Other citizens "endorse" the proposal. Reach 10 endorsements and the Speaker auto-grants the debate.',
              },
              {
                step: '3',
                text: 'Elders may also grant or deny any proposal independently, with a written ruling.',
              },
              {
                step: '4',
                text: 'Granted debates open a live debate room visible across the platform. Proposals expire after 24 hours if not granted.',
              },
            ].map((item) => (
              <li key={item.step} className="flex items-start gap-3">
                <span className="flex-shrink-0 h-5 w-5 rounded-full bg-surface-300/60 border border-surface-400/40 flex items-center justify-center text-[10px] font-mono font-bold text-surface-400">
                  {item.step}
                </span>
                <p className="text-xs text-surface-500 leading-relaxed">{item.text}</p>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/urgent-questions"
              className="text-[11px] text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
            >
              Urgent Questions <ArrowRight className="h-3 w-3" />
            </Link>
            <span className="text-surface-600 text-[11px]">·</span>
            <Link
              href="/supply-day"
              className="text-[11px] text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
            >
              Supply Day <ArrowRight className="h-3 w-3" />
            </Link>
            <span className="text-surface-600 text-[11px]">·</span>
            <Link
              href="/adjournment"
              className="text-[11px] text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
            >
              Adjournment Debates <ArrowRight className="h-3 w-3" />
            </Link>
            <span className="text-surface-600 text-[11px]">·</span>
            <Link
              href="/parliament"
              className="text-[11px] text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
            >
              Parliament Hub <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </main>

      <BottomNav />

      {/* Propose modal */}
      <AnimatePresence>
        {showPropose && (
          <ProposeModal
            onClose={() => setShowPropose(false)}
            onSubmit={handlePropose}
            submitting={submitting}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
