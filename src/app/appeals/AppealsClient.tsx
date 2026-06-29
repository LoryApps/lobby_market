'use client'

/**
 * /appeals — The Civic Appeals Panel
 *
 * Final civic recourse tier above the Ombudsman. Citizens can formally appeal:
 *   ombudsman  — a dismissed or upheld Ombudsman finding
 *   council    — a Grand Council motion outcome
 *   moderation — a moderation action (ban, removal, demotion)
 *   vote       — a disputed topic vote result
 *
 * A rotating panel of three senior citizens deliberates each appeal.
 * 2-of-3 majority grants or denies. Granted appeals trigger a formal re-review.
 *
 * Status flow: pending → reviewing → granted | denied | withdrawn
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileQuestion,
  Gavel,
  Info,
  Loader2,
  RefreshCw,
  Scale,
  Send,
  Shield,
  ThumbsUp,
  User,
  Vote,
  X,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import { createClient } from '@/lib/supabase/client'
import type {
  CivicAppeal,
  AppealListResponse,
  AppealType,
  AppealStatus,
  AppealGrounds,
} from '@/app/api/appeals/route'

// ─── Config maps ──────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<AppealType, {
  label: string
  icon: typeof Scale
  color: string
  bg: string
  border: string
  description: string
}> = {
  ombudsman:  { label: 'Ombudsman Finding', icon: Scale,       color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     description: 'Contest an Ombudsman case decision' },
  council:    { label: 'Council Motion',    icon: Gavel,       color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30',        description: 'Challenge a Grand Council vote outcome' },
  moderation: { label: 'Moderation Action', icon: Shield,      color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', description: 'Appeal a moderation decision against you' },
  vote:       { label: 'Vote Outcome',      icon: Vote,        color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30',      description: 'Contest a disputed topic vote result' },
}

const STATUS_CONFIG: Record<AppealStatus, {
  label: string
  color: string
  bg: string
  border: string
  icon: typeof Clock
}> = {
  pending:   { label: 'Pending Panel',  color: 'text-for-300',    bg: 'bg-for-500/10',     border: 'border-for-500/30',     icon: Clock },
  reviewing: { label: 'Under Review',   color: 'text-gold',       bg: 'bg-gold/10',        border: 'border-gold/30',        icon: Loader2 },
  granted:   { label: 'Granted',        color: 'text-emerald',    bg: 'bg-emerald/10',     border: 'border-emerald/30',     icon: CheckCircle2 },
  denied:    { label: 'Denied',         color: 'text-surface-500',bg: 'bg-surface-300/40', border: 'border-surface-400/30', icon: XCircle },
  withdrawn: { label: 'Withdrawn',      color: 'text-surface-400',bg: 'bg-surface-300/20', border: 'border-surface-400/20', icon: X },
}

const GROUNDS_OPTIONS: { value: AppealGrounds; label: string; description: string }[] = [
  { value: 'procedural_error', label: 'Procedural Error',   description: 'The original process violated established civic procedures' },
  { value: 'new_evidence',     label: 'New Evidence',       description: 'Significant evidence has emerged that was unavailable before' },
  { value: 'bias',             label: 'Demonstrated Bias',  description: 'The decision shows demonstrable bias toward a party or position' },
  { value: 'disproportionate', label: 'Disproportionate',   description: 'The outcome is disproportionate to the circumstances' },
  { value: 'other',            label: 'Other Grounds',      description: 'Other valid grounds not covered above' },
]

const STATUS_TABS: { value: AppealStatus | 'all'; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'pending',   label: 'Pending' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'granted',   label: 'Granted' },
  { value: 'denied',    label: 'Denied' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  if (mins < 60)   return `${mins}m ago`
  const hrs   = Math.floor(mins / 60)
  if (hrs  < 24)   return `${hrs}h ago`
  const days  = Math.floor(hrs  / 24)
  if (days < 30)   return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function PanelVoteBar({ votesFor, votesAgainst, votesAbstain }: {
  votesFor: number; votesAgainst: number; votesAbstain: number
}) {
  const total = votesFor + votesAgainst + votesAbstain
  if (total === 0) return null
  return (
    <div className="flex items-center gap-2 mt-3">
      <div className="flex-1 flex h-1.5 rounded-full overflow-hidden gap-px bg-surface-200">
        {votesFor > 0 && (
          <div
            className="bg-emerald h-full rounded-l-full transition-all"
            style={{ width: `${(votesFor / 3) * 100}%` }}
          />
        )}
        {votesAgainst > 0 && (
          <div
            className="bg-against-500 h-full transition-all"
            style={{ width: `${(votesAgainst / 3) * 100}%` }}
          />
        )}
        {votesAbstain > 0 && (
          <div
            className="bg-surface-400 h-full rounded-r-full transition-all"
            style={{ width: `${(votesAbstain / 3) * 100}%` }}
          />
        )}
      </div>
      <span className="text-xs font-mono text-surface-500 whitespace-nowrap">
        {votesFor}–{votesAgainst}
        {votesAbstain > 0 && ` (${votesAbstain} abs.)`}
      </span>
    </div>
  )
}

// ─── Appeal Card ──────────────────────────────────────────────────────────────

function AppealCard({
  appeal,
  onSupport,
  supporting,
}: {
  appeal: CivicAppeal
  onSupport: (id: string) => void
  supporting: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const typeConf   = TYPE_CONFIG[appeal.appeal_type]
  const statusConf = STATUS_CONFIG[appeal.status]
  const TypeIcon   = typeConf.icon
  const StatusIcon = statusConf.icon
  const isActive   = appeal.status === 'pending' || appeal.status === 'reviewing'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-surface-300/60 bg-surface-100 overflow-hidden"
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          <div className={cn('flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0', typeConf.bg, typeConf.border, 'border')}>
            <TypeIcon className={cn('h-4 w-4', typeConf.color)} aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-mono text-xs text-surface-500">{appeal.appeal_number}</span>
              <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono border', statusConf.bg, statusConf.border, statusConf.color)}>
                <StatusIcon className="h-3 w-3" aria-hidden />
                {statusConf.label}
              </span>
              <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-mono border', typeConf.bg, typeConf.border, typeConf.color)}>
                {typeConf.label}
              </span>
            </div>
            {appeal.target_label && (
              <p className="text-xs text-surface-500 font-mono truncate">
                re: {appeal.target_label}
              </p>
            )}
          </div>
        </div>

        {/* Statement preview */}
        <p className={cn(
          'text-sm font-mono text-surface-300 leading-relaxed mb-3',
          !expanded && 'line-clamp-3',
        )}>
          {appeal.statement}
        </p>

        {/* Panel decision (if resolved) */}
        <AnimatePresence>
          {expanded && appeal.panel_decision && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={cn(
                'mb-3 rounded-lg border px-3 py-2.5',
                appeal.status === 'granted'
                  ? 'bg-emerald/5 border-emerald/30'
                  : 'bg-surface-200/50 border-surface-300/40',
              )}
            >
              <p className="text-xs font-mono font-bold text-surface-400 uppercase tracking-wider mb-1">Panel Decision</p>
              <p className="text-sm font-mono text-surface-300 leading-relaxed">{appeal.panel_decision}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Panel vote bar */}
        <PanelVoteBar
          votesFor={appeal.votes_for}
          votesAgainst={appeal.votes_against}
          votesAbstain={appeal.votes_abstain}
        />

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-300/40">
          <div className="flex items-center gap-2">
            {appeal.appellant && (
              <>
                <Avatar
                  src={appeal.appellant.avatar_url}
                  username={appeal.appellant.username}
                  size={20}
                  className="ring-1 ring-surface-300/40"
                />
                <span className="text-xs font-mono text-surface-500">
                  @{appeal.appellant.username}
                </span>
              </>
            )}
            <span className="text-xs font-mono text-surface-600">{timeAgo(appeal.created_at)}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Support button */}
            {isActive && (
              <button
                onClick={() => onSupport(appeal.id)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors',
                  appeal.user_supported
                    ? 'bg-for-500/20 border-for-500/40 text-for-300'
                    : 'bg-surface-200/60 border-surface-300/40 text-surface-500 hover:text-white hover:border-surface-400',
                  supporting && 'opacity-60 pointer-events-none',
                )}
                aria-pressed={appeal.user_supported}
                aria-label={appeal.user_supported ? 'Remove support' : 'Support this appeal'}
              >
                <ThumbsUp className="h-3 w-3" aria-hidden />
                {appeal.support_count}
              </button>
            )}

            {/* Expand toggle */}
            <button
              onClick={() => setExpanded((p) => !p)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-200/60 border border-surface-300/40 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse' : 'Read full statement'}
            >
              {expanded ? <ChevronUp className="h-3 w-3" aria-hidden /> : <ChevronDown className="h-3 w-3" aria-hidden />}
              {expanded ? 'Less' : 'More'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── File Appeal Modal ─────────────────────────────────────────────────────────

function FileAppealModal({ onClose, onSuccess }: {
  onClose: () => void
  onSuccess: (appealNumber: string) => void
}) {
  const [appealType, setAppealType]     = useState<AppealType>('ombudsman')
  const [grounds, setGrounds]           = useState<AppealGrounds>('procedural_error')
  const [targetLabel, setTargetLabel]   = useState('')
  const [statement, setStatement]       = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(async () => {
    setError(null)
    if (statement.trim().length < 80) {
      setError('Statement must be at least 80 characters.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/appeals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appeal_type:  appealType,
          target_type:  appealType,
          target_label: targetLabel.trim() || null,
          grounds,
          statement:    statement.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        const msgMap: Record<string, string> = {
          unauthenticated: 'You must be signed in to file an appeal.',
          invalid_appeal_type: 'Please select a valid appeal type.',
          invalid_grounds: 'Please select valid grounds.',
          invalid_statement: 'Statement must be between 80 and 2000 characters.',
          duplicate_appeal: 'You already have an open appeal for this matter.',
        }
        setError(msgMap[json.error] ?? 'Something went wrong. Please try again.')
        return
      }
      onSuccess(json.appeal_number)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [appealType, grounds, targetLabel, statement, onSuccess])

  const selectedGrounds = GROUNDS_OPTIONS.find((g) => g.value === grounds)!

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        className="relative w-full max-w-lg bg-surface-100 rounded-2xl border border-surface-300/60 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-surface-300/40">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gold/10 border border-gold/30">
              <Scale className="h-4 w-4 text-gold" aria-hidden />
            </div>
            <div>
              <h2 className="font-mono text-sm font-bold text-white">File an Appeal</h2>
              <p className="text-xs font-mono text-surface-500">Formal recourse to the Civic Panel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Appeal type */}
          <div>
            <label className="block text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider mb-2">
              What are you appealing?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(TYPE_CONFIG) as [AppealType, typeof TYPE_CONFIG[AppealType]][]).map(([type, conf]) => {
                const Icon = conf.icon
                return (
                  <button
                    key={type}
                    onClick={() => setAppealType(type)}
                    className={cn(
                      'flex items-start gap-2.5 p-3 rounded-xl border text-left transition-colors',
                      appealType === type
                        ? cn(conf.bg, conf.border, conf.color)
                        : 'bg-surface-200/60 border-surface-300/40 text-surface-500 hover:text-surface-300',
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden />
                    <div>
                      <p className="text-xs font-mono font-semibold leading-tight">{conf.label}</p>
                      <p className="text-xs font-mono text-surface-500 leading-tight mt-0.5 line-clamp-2">{conf.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Target label (optional) */}
          <div>
            <label htmlFor="target-label" className="block text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider mb-1.5">
              Reference (optional)
            </label>
            <input
              id="target-label"
              type="text"
              value={targetLabel}
              onChange={(e) => setTargetLabel(e.target.value)}
              placeholder="e.g. OM-2026-0012 or Grand Council Motion #47"
              maxLength={300}
              className="w-full bg-surface-200/60 border border-surface-300/50 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-surface-600 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-colors"
            />
          </div>

          {/* Grounds */}
          <div>
            <label className="block text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider mb-2">
              Grounds for Appeal
            </label>
            <div className="space-y-1.5">
              {GROUNDS_OPTIONS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setGrounds(g.value)}
                  className={cn(
                    'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors',
                    grounds === g.value
                      ? 'bg-for-500/10 border-for-500/30 text-for-300'
                      : 'bg-surface-200/60 border-surface-300/40 text-surface-500 hover:text-surface-300',
                  )}
                >
                  <div className={cn(
                    'mt-0.5 h-3.5 w-3.5 rounded-full border-2 flex-shrink-0 transition-colors',
                    grounds === g.value ? 'border-for-400 bg-for-400' : 'border-surface-500',
                  )} />
                  <div>
                    <p className="text-xs font-mono font-semibold">{g.label}</p>
                    <p className="text-xs font-mono text-surface-500 mt-0.5">{g.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Statement */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="appeal-statement" className="block text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
                Appeal Statement
              </label>
              <span className={cn('text-xs font-mono', statement.length > 2000 ? 'text-against-400' : 'text-surface-600')}>
                {statement.length}/2000
              </span>
            </div>
            <textarea
              id="appeal-statement"
              ref={textareaRef}
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="Set out clearly why this decision should be reconsidered. Include all relevant facts, the specific procedural or substantive error, and what remedy you seek. (min. 80 characters)"
              rows={5}
              maxLength={2000}
              className="w-full bg-surface-200/60 border border-surface-300/50 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-surface-600 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-colors resize-none leading-relaxed"
            />
            <p className="mt-1 text-xs font-mono text-surface-600">
              Grounds selected: <span className="text-surface-400">{selectedGrounds.label}</span>
            </p>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-against-500/10 border border-against-500/30 text-against-400 text-xs font-mono"
              >
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-surface-300/40 flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting || statement.trim().length < 80}
            className="flex-1 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Submitting…</>
            ) : (
              <><Send className="h-3.5 w-3.5" aria-hidden /> File Appeal</>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AppealsClient() {
  const [appeals, setAppeals]       = useState<CivicAppeal[]>([])
  const [stats, setStats]           = useState({ total: 0, pending: 0, reviewing: 0, granted: 0, denied: 0 })
  const [statusFilter, setStatus]   = useState<AppealStatus | 'all'>('all')
  const [typeFilter, setType]       = useState<AppealType | 'all'>('all')
  const [sort, setSort]             = useState<'newest' | 'supported'>('newest')
  const [loading, setLoading]       = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore]       = useState(false)
  const [total, setTotal]           = useState(0)
  const [showModal, setShowModal]   = useState(false)
  const [successNumber, setSuccess] = useState<string | null>(null)
  const [supporting, setSupporting] = useState<Set<string>>(new Set())
  const offsetRef = useRef(0)
  const PAGE = 15

  const load = useCallback(async (reset = true) => {
    const off = reset ? 0 : offsetRef.current
    if (reset) { setLoading(true); setAppeals([]) }
    else setLoadingMore(true)

    const params = new URLSearchParams({
      status: statusFilter,
      sort,
      limit: String(PAGE),
      offset: String(off),
    })
    if (typeFilter !== 'all') params.set('type', typeFilter)

    try {
      const res  = await fetch(`/api/appeals?${params}`)
      const data: AppealListResponse = await res.json()
      setAppeals((prev) => reset ? data.appeals : [...prev, ...data.appeals])
      setTotal(data.total)
      setStats(data.stats)
      offsetRef.current = off + data.appeals.length
      setHasMore(off + data.appeals.length < data.total)
    } catch {
      // silently stay on last known state
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [statusFilter, typeFilter, sort])

  useEffect(() => { load(true) }, [load])

  const handleSupport = useCallback(async (id: string) => {
    setSupporting((s) => new Set(s).add(id))
    try {
      const supabase = createClient()
      const { data } = await supabase.rpc('toggle_appeal_support', { p_appeal_id: id })
      if (data && !data.error) {
        setAppeals((prev) => prev.map((a) =>
          a.id === id
            ? { ...a, user_supported: data.supported, support_count: data.support_count }
            : a
        ))
      }
    } finally {
      setSupporting((s) => { const n = new Set(s); n.delete(id); return n })
    }
  }, [])

  const handleSuccess = useCallback((appealNumber: string) => {
    setShowModal(false)
    setSuccess(appealNumber)
    load(true)
    setTimeout(() => setSuccess(null), 6000)
  }, [load])

  const statItems = [
    { label: 'Total',     value: stats.total,     color: 'text-white' },
    { label: 'Pending',   value: stats.pending,   color: 'text-for-400' },
    { label: 'Reviewing', value: stats.reviewing, color: 'text-gold' },
    { label: 'Granted',   value: stats.granted,   color: 'text-emerald' },
  ]

  return (
    <>
      <TopBar />
      <main className="min-h-screen bg-surface-50 pb-28 pt-16">
        <div className="max-w-2xl mx-auto px-4">

          {/* Hero */}
          <div className="pt-6 pb-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gold/10 border border-gold/30">
                    <Scale className="h-4 w-4 text-gold" aria-hidden />
                  </div>
                  <h1 className="font-mono text-lg font-bold text-white tracking-tight">
                    Civic Appeals Panel
                  </h1>
                </div>
                <p className="text-sm font-mono text-surface-400 leading-relaxed max-w-lg">
                  The final civic recourse tier. Contest decisions from the Ombudsman, Grand Council,
                  moderation, and disputed votes. A rotating panel of three senior citizens deliberates.
                </p>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-gold hover:bg-gold/90 text-surface-50 text-sm font-mono font-bold transition-colors shadow-lg shadow-gold/20"
              >
                <ArrowUpRight className="h-4 w-4" aria-hidden />
                File Appeal
              </button>
            </div>

            {/* Info callout */}
            <div className="mt-4 rounded-xl border border-surface-300/40 bg-surface-200/40 px-4 py-3 flex items-start gap-3">
              <Info className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" aria-hidden />
              <p className="text-xs font-mono text-surface-500 leading-relaxed">
                Appeals are heard by a rotating panel of three citizens with civic trust ≥ 50
                who were not involved in the original decision. A 2-of-3 majority grants or denies.
                Granted appeals trigger a formal re-review.
              </p>
            </div>
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {statItems.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-surface-300/50 bg-surface-100 px-3 py-3 text-center"
              >
                <p className={cn('font-mono text-xl font-bold', s.color)}>{s.value}</p>
                <p className="font-mono text-xs text-surface-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Success banner */}
          <AnimatePresence>
            {successNumber && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-4 flex items-center gap-3 rounded-xl border border-emerald/30 bg-emerald/10 px-4 py-3"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald flex-shrink-0" aria-hidden />
                <div>
                  <p className="text-sm font-mono font-bold text-emerald">Appeal filed: {successNumber}</p>
                  <p className="text-xs font-mono text-emerald/70">The panel has been notified. You will receive updates as deliberation proceeds.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            {/* Status tabs */}
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatus(tab.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors',
                    statusFilter === tab.value
                      ? 'bg-for-500/10 border-for-500/30 text-for-300'
                      : 'bg-surface-200/60 border-surface-300/40 text-surface-500 hover:text-white',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex gap-1.5 ml-auto">
              {/* Type filter */}
              <select
                value={typeFilter}
                onChange={(e) => setType(e.target.value as AppealType | 'all')}
                className="px-2.5 py-1.5 rounded-lg text-xs font-mono bg-surface-200/60 border border-surface-300/40 text-surface-400 focus:outline-none focus:border-surface-400 cursor-pointer"
                aria-label="Filter by type"
              >
                <option value="all">All Types</option>
                {(Object.entries(TYPE_CONFIG) as [AppealType, typeof TYPE_CONFIG[AppealType]][]).map(([t, c]) => (
                  <option key={t} value={t}>{c.label}</option>
                ))}
              </select>

              {/* Sort */}
              <button
                onClick={() => setSort((s) => s === 'newest' ? 'supported' : 'newest')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-200/60 border border-surface-300/40 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                aria-label={`Sort by ${sort === 'newest' ? 'most supported' : 'newest'}`}
              >
                <RefreshCw className="h-3 w-3" aria-hidden />
                {sort === 'newest' ? 'Newest' : 'Most Supported'}
              </button>
            </div>
          </div>

          {/* Appeal list */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-surface-300/40 bg-surface-100 p-4 space-y-3">
                  <div className="flex gap-3">
                    <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-2/3 rounded" />
                      <Skeleton className="h-3 w-1/3 rounded" />
                    </div>
                  </div>
                  <Skeleton className="h-12 w-full rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                </div>
              ))}
            </div>
          ) : appeals.length === 0 ? (
            <EmptyState
              icon={FileQuestion}
              title="No appeals found"
              description={
                statusFilter !== 'all'
                  ? `No ${statusFilter} appeals yet.`
                  : 'No appeals have been filed yet. Be the first to invoke the Panel.'
              }
            />
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {appeals.map((appeal) => (
                  <AppealCard
                    key={appeal.id}
                    appeal={appeal}
                    onSupport={handleSupport}
                    supporting={supporting.has(appeal.id)}
                  />
                ))}
              </AnimatePresence>

              {hasMore && (
                <button
                  onClick={() => load(false)}
                  disabled={loadingMore}
                  className="w-full py-3 rounded-xl border border-surface-300/40 bg-surface-100 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors flex items-center justify-center gap-2"
                >
                  {loadingMore ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading…</>
                  ) : (
                    `Load more · ${total - appeals.length} remaining`
                  )}
                </button>
              )}
            </div>
          )}

          {/* Panel info footer */}
          <div className="mt-8 rounded-xl border border-surface-300/30 bg-surface-100/50 p-5">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-surface-500" aria-hidden />
              <h3 className="font-mono text-xs font-bold text-surface-400 uppercase tracking-wider">How the Panel Works</h3>
            </div>
            <div className="space-y-2">
              {[
                { icon: User,          text: 'A rotating panel of three citizens (civic trust ≥ 50) is assigned to each appeal.' },
                { icon: Scale,         text: 'Panel members may not have been involved in the original decision.' },
                { icon: Vote,          text: '2-of-3 majority grants or denies. Panel deliberation typically takes 48–72 hours.' },
                { icon: CheckCircle2,  text: 'Granted appeals trigger a formal re-review with the original authority.' },
                { icon: Shield,        text: 'Frivolous appeals may result in a temporary filing restriction.' },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <Icon className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" aria-hidden />
                  <p className="text-xs font-mono text-surface-500 leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
      <BottomNav />

      {/* File appeal modal */}
      <AnimatePresence>
        {showModal && (
          <FileAppealModal
            onClose={() => setShowModal(false)}
            onSuccess={handleSuccess}
          />
        )}
      </AnimatePresence>
    </>
  )
}
