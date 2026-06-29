'use client'

/**
 * /ombudsman — The Civic Ombudsman
 *
 * An independent oversight authority where citizens can file formal complaints
 * about civic process fairness, contested decisions, and norm breaches.
 * Distinct from /moderation (content violations) and /tribunal (argument
 * quality).  The Ombudsman is about process integrity and civic accountability.
 *
 * Case flow: open → under_review → upheld | dismissed | referred | withdrawn
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Gavel,
  Info,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  Send,
  Shield,
  ThumbsUp,
  User,
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
import type { OmbudsmanCase, OmbudsmanResponse, CaseCategory, CaseStatus } from '@/app/api/ombudsman/route'
import type { StatementRow, CaseDetailResponse } from '@/app/api/ombudsman/[id]/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<CaseCategory, { label: string; icon: typeof Scale; color: string; bg: string; border: string }> = {
  process_fairness: { label: 'Process Fairness', icon: Scale, color: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/30' },
  decision_appeal:  { label: 'Decision Appeal',  icon: Gavel,  color: 'text-gold',     bg: 'bg-gold/10',     border: 'border-gold/30' },
  bias_report:      { label: 'Bias Report',       icon: AlertCircle, color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  norm_breach:      { label: 'Norm Breach',        icon: Shield, color: 'text-purple',   bg: 'bg-purple/10',   border: 'border-purple/30' },
  transparency:     { label: 'Transparency',       icon: BookOpen, color: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
  other:            { label: 'Other',              icon: FileText, color: 'text-surface-500', bg: 'bg-surface-300/40', border: 'border-surface-400/30' },
}

const STATUS_CONFIG: Record<CaseStatus, { label: string; color: string; bg: string; border: string; icon: typeof Clock }> = {
  open:         { label: 'Open',         color: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30',      icon: Clock },
  under_review: { label: 'Under Review', color: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30',         icon: Loader2 },
  upheld:       { label: 'Upheld',       color: 'text-for-400',      bg: 'bg-for-500/10',      border: 'border-for-500/30',      icon: CheckCircle2 },
  dismissed:    { label: 'Dismissed',    color: 'text-surface-500',  bg: 'bg-surface-300/40',  border: 'border-surface-400/30',  icon: XCircle },
  referred:     { label: 'Referred',     color: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/30',       icon: ArrowRight },
  withdrawn:    { label: 'Withdrawn',    color: 'text-surface-500',  bg: 'bg-surface-300/20',  border: 'border-surface-400/20',  icon: X },
}

const CATEGORY_OPTIONS: { value: CaseCategory | 'all'; label: string }[] = [
  { value: 'all',              label: 'All Categories' },
  { value: 'process_fairness', label: 'Process Fairness' },
  { value: 'decision_appeal',  label: 'Decision Appeal' },
  { value: 'bias_report',      label: 'Bias Report' },
  { value: 'norm_breach',      label: 'Norm Breach' },
  { value: 'transparency',     label: 'Transparency' },
  { value: 'other',            label: 'Other' },
]

const STATUS_TABS: { value: CaseStatus | 'all'; label: string }[] = [
  { value: 'open',         label: 'Open' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'upheld',       label: 'Upheld' },
  { value: 'dismissed',    label: 'Dismissed' },
  { value: 'all',          label: 'All' },
]

const RESPONDENT_TYPES = [
  { value: 'user',      label: 'A specific citizen' },
  { value: 'committee', label: 'A civic committee' },
  { value: 'council',   label: 'The Grand Council' },
  { value: 'assembly',  label: 'The Citizens\' Assembly' },
  { value: 'platform',  label: 'Platform policy / system' },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300">
      <span className={cn('text-lg font-bold tabular-nums', color)}>{value}</span>
      <span className="text-xs text-surface-500">{label}</span>
    </div>
  )
}

function CaseCard({
  caseItem,
  userId,
  onToggleSupport,
  onSelect,
}: {
  caseItem: OmbudsmanCase
  userId: string | null
  onToggleSupport: (id: string) => void
  onSelect: (c: OmbudsmanCase) => void
}) {
  const cat = CATEGORY_CONFIG[caseItem.category]
  const sta = STATUS_CONFIG[caseItem.status]
  const CatIcon = cat.icon
  const StaIcon = sta.icon
  const progress = Math.min(100, (caseItem.support_count / 10) * 100)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="group bg-surface-100 border border-surface-300 rounded-xl overflow-hidden hover:border-surface-400 transition-colors"
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn('flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border', cat.bg, cat.border, cat.color)}>
              <CatIcon className="h-3 w-3" />
              {cat.label}
            </span>
            <span className={cn('flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border', sta.bg, sta.border, sta.color)}>
              <StaIcon className="h-3 w-3" />
              {sta.label}
            </span>
          </div>
          <span className="text-xs text-surface-500 font-mono shrink-0">{caseItem.case_number}</span>
        </div>

        <button
          onClick={() => onSelect(caseItem)}
          className="text-left w-full group/title"
        >
          <h3 className="text-sm font-semibold text-white leading-snug group-hover/title:text-for-300 transition-colors line-clamp-2">
            {caseItem.title}
          </h3>
        </button>

        {caseItem.topic_statement && (
          <p className="mt-1.5 text-xs text-surface-500 line-clamp-1">
            Re: {caseItem.topic_statement}
          </p>
        )}

        <p className="mt-2 text-xs text-surface-600 line-clamp-2 leading-relaxed">
          {caseItem.description}
        </p>
      </div>

      {/* Finding banner */}
      {caseItem.finding && (
        <div className={cn('px-4 py-2.5 border-t border-surface-300 text-xs', sta.bg)}>
          <p className={cn('font-medium mb-0.5', sta.color)}>Officer Finding</p>
          <p className="text-surface-600 line-clamp-2">{caseItem.finding}</p>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 pb-3 pt-2 flex items-center justify-between border-t border-surface-300">
        <div className="flex items-center gap-2">
          {caseItem.complainant && (
            <div className="flex items-center gap-1.5">
              <Avatar
                src={caseItem.complainant.avatar_url}
                username={caseItem.complainant.username}
                size={16}
                className="rounded-full"
              />
              <span className="text-xs text-surface-500">
                {caseItem.complainant.display_name ?? caseItem.complainant.username}
              </span>
            </div>
          )}
          <span className="text-xs text-surface-600">{formatDate(caseItem.created_at)}</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelect(caseItem)}
            className="text-xs text-surface-500 hover:text-white flex items-center gap-1 transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            View
          </button>
          {userId && ['open', 'under_review'].includes(caseItem.status) && (
            <button
              onClick={() => onToggleSupport(caseItem.id)}
              className={cn(
                'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors',
                caseItem.user_supported
                  ? 'bg-for-500/20 border-for-500/40 text-for-300'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white'
              )}
            >
              <ThumbsUp className="h-3 w-3" />
              {caseItem.support_count}
            </button>
          )}
          {!userId && (
            <span className="text-xs text-surface-600 flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" />
              {caseItem.support_count}
            </span>
          )}
        </div>
      </div>

      {/* Support progress bar for open cases */}
      {caseItem.status === 'open' && (
        <div className="h-0.5 bg-surface-300">
          <div
            className="h-full bg-for-500/60 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </motion.div>
  )
}

// ─── Case detail modal ────────────────────────────────────────────────────────

function CaseModal({
  caseItem,
  userId,
  onClose,
  onToggleSupport,
}: {
  caseItem: OmbudsmanCase
  userId: string | null
  onClose: () => void
  onToggleSupport: (id: string) => void
}) {
  const [statements, setStatements] = useState<StatementRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const cat = CATEGORY_CONFIG[caseItem.category]
  const sta = STATUS_CONFIG[caseItem.status]

  const loadStatements = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ombudsman/${caseItem.id}`)
      if (!res.ok) return
      const data: CaseDetailResponse = await res.json()
      setStatements(data.statements)
      setTotal(data.total)
    } finally {
      setLoading(false)
    }
  }, [caseItem.id])

  useEffect(() => { loadStatements() }, [loadStatements])

  const handleSubmit = async () => {
    if (!draft.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/ombudsman/${caseItem.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft.trim() }),
      })
      if (res.ok) {
        setDraft('')
        await loadStatements()
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const ROLE_STYLE: Record<string, { label: string; color: string }> = {
    complainant: { label: 'Complainant', color: 'text-for-400' },
    officer:     { label: 'Officer',     color: 'text-gold' },
    observer:    { label: 'Observer',    color: 'text-surface-500' },
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="relative w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] bg-surface-100 border border-surface-300 rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-surface-300 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={cn('flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border', cat.bg, cat.border, cat.color)}>
                <cat.icon className="h-3 w-3" />
                {cat.label}
              </span>
              <span className={cn('flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border', sta.bg, sta.border, sta.color)}>
                <sta.icon className="h-3 w-3" />
                {sta.label}
              </span>
              <span className="text-xs text-surface-500 font-mono">{caseItem.case_number}</span>
            </div>
            <h2 className="text-base font-bold text-white leading-snug">{caseItem.title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-200 text-surface-500 hover:text-white transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Description */}
          <div className="px-5 py-4 border-b border-surface-300">
            <p className="text-sm text-surface-600 leading-relaxed">{caseItem.description}</p>
            {caseItem.topic_statement && (
              <div className="mt-3 p-3 bg-surface-200 rounded-lg border border-surface-300">
                <p className="text-xs text-surface-500 mb-1">Related Topic</p>
                <p className="text-sm text-white">{caseItem.topic_statement}</p>
              </div>
            )}
            <div className="flex items-center gap-4 mt-3 text-xs text-surface-500">
              {caseItem.complainant && (
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Filed by {caseItem.complainant.display_name ?? caseItem.complainant.username}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {formatDate(caseItem.created_at)}
              </span>
              <button
                onClick={() => onToggleSupport(caseItem.id)}
                disabled={!userId || !['open', 'under_review'].includes(caseItem.status)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors',
                  caseItem.user_supported
                    ? 'bg-for-500/20 border-for-500/40 text-for-300'
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <ThumbsUp className="h-3 w-3" />
                {caseItem.support_count} support
              </button>
            </div>
          </div>

          {/* Formal finding */}
          {caseItem.finding && (
            <div className={cn('px-5 py-4 border-b border-surface-300', sta.bg)}>
              <div className="flex items-center gap-2 mb-2">
                <Gavel className={cn('h-4 w-4', sta.color)} />
                <span className={cn('text-sm font-semibold', sta.color)}>
                  Formal Finding — {sta.label}
                </span>
                {caseItem.officer && (
                  <span className="ml-auto text-xs text-surface-500">
                    Officer: {caseItem.officer.display_name ?? caseItem.officer.username}
                  </span>
                )}
              </div>
              <p className="text-sm text-surface-600 leading-relaxed">{caseItem.finding}</p>
              {caseItem.resolved_at && (
                <p className="mt-2 text-xs text-surface-500">{formatDate(caseItem.resolved_at)}</p>
              )}
            </div>
          )}

          {/* Statements */}
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
              Public Record ({total} statement{total !== 1 ? 's' : ''})
            </p>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : statements.length === 0 ? (
              <p className="text-sm text-surface-500 py-4 text-center">
                No statements yet. Be the first to add to the public record.
              </p>
            ) : (
              <div className="space-y-3">
                {statements.map((s) => {
                  const rs = ROLE_STYLE[s.role] ?? ROLE_STYLE.observer
                  return (
                    <div key={s.id} className="flex gap-3">
                      <Avatar
                        src={s.author?.avatar_url ?? null}
                        username={s.author?.username ?? '?'}
                        size={28}
                        className="rounded-full shrink-0 mt-0.5"
                      />
                      <div className="flex-1 bg-surface-200 rounded-xl px-3 py-2.5">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-white">
                            {s.author?.display_name ?? s.author?.username ?? 'Anonymous'}
                          </span>
                          <span className={cn('text-xs font-medium', rs.color)}>{rs.label}</span>
                          <span className="ml-auto text-xs text-surface-500">{timeAgo(s.created_at)}</span>
                        </div>
                        <p className="text-sm text-surface-600 leading-relaxed">{s.content}</p>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </div>

        {/* Statement input */}
        {userId && ['open', 'under_review'].includes(caseItem.status) && (
          <div className="px-5 py-4 border-t border-surface-300 shrink-0">
            <div className="flex gap-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add a statement to the public record…"
                maxLength={1000}
                rows={2}
                className="flex-1 bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-surface-500 resize-none focus:outline-none focus:border-for-500/50 transition-colors"
              />
              <Button
                onClick={handleSubmit}
                disabled={draft.trim().length < 10 || submitting}
                size="sm"
                className="self-end"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-surface-600 mt-1.5">
              {draft.length}/1000 — all statements are permanently part of the public record
            </p>
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ─── File case form ───────────────────────────────────────────────────────────

function FileCaseForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<CaseCategory>('process_fairness')
  const [respondentType, setRespondentType] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (submitting) return
    if (title.length < 10) { setError('Title must be at least 10 characters.'); return }
    if (description.length < 50) { setError('Description must be at least 50 characters.'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/ombudsman', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          respondent_type: respondentType || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to file case.')
        return
      }
      onSuccess()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="relative w-full sm:max-w-lg max-h-[92vh] bg-surface-100 border border-surface-300 rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-surface-300 shrink-0">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-for-400" />
            <h2 className="text-base font-bold text-white">File a Case</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-200 text-surface-500 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
              Case Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(CATEGORY_CONFIG) as [CaseCategory, typeof CATEGORY_CONFIG[CaseCategory]][]).map(([value, cfg]) => (
                <button
                  key={value}
                  onClick={() => setCategory(value)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-colors',
                    category === value
                      ? cn(cfg.bg, cfg.border, cfg.color)
                      : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white'
                  )}
                >
                  <cfg.icon className="h-3.5 w-3.5 shrink-0" />
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
              Case Title <span className="text-surface-600 normal-case font-normal">(10–200 chars)</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Briefly state the nature of the complaint…"
              maxLength={200}
              className="w-full bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-for-500/50 transition-colors"
            />
            <p className="text-xs text-surface-600 mt-1">{title.length}/200</p>
          </div>

          {/* Respondent */}
          <div>
            <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
              Complaint Against <span className="text-surface-600 normal-case font-normal">(optional)</span>
            </label>
            <select
              value={respondentType}
              onChange={(e) => setRespondentType(e.target.value)}
              className="w-full bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-for-500/50 transition-colors"
            >
              <option value="">Select respondent type…</option>
              {RESPONDENT_TYPES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
              Description <span className="text-surface-600 normal-case font-normal">(50–3000 chars)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide full details of your complaint — what happened, when, and what resolution you are seeking. Your description becomes part of the permanent public record."
              maxLength={3000}
              rows={6}
              className="w-full bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-surface-500 resize-none focus:outline-none focus:border-for-500/50 transition-colors"
            />
            <p className="text-xs text-surface-600 mt-1">{description.length}/3000</p>
          </div>

          {/* Warning */}
          <div className="flex gap-2 p-3 bg-surface-200 rounded-lg border border-surface-300">
            <Info className="h-4 w-4 text-surface-500 shrink-0 mt-0.5" />
            <p className="text-xs text-surface-500 leading-relaxed">
              All case details are public and permanently recorded. The Ombudsman reviews complaints
              in order of support and severity. Frivolous complaints may be dismissed without review.
            </p>
          </div>

          {error && (
            <p className="text-sm text-against-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <div className="px-5 pb-5 pt-3 border-t border-surface-300 shrink-0">
          <Button
            onClick={handleSubmit}
            disabled={title.length < 10 || description.length < 50 || submitting}
            className="w-full"
          >
            {submitting ? (
              <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Filing case…</span>
            ) : (
              <span className="flex items-center gap-2"><Scale className="h-4 w-4" />File Case with the Ombudsman</span>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OmbudsmanClient() {
  const [cases, setCases] = useState<OmbudsmanCase[]>([])
  const [total, setTotal] = useState(0)
  const [openCount, setOpenCount] = useState(0)
  const [stats, setStats] = useState({ upheld: 0, dismissed: 0, under_review: 0 })
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  const [activeStatus, setActiveStatus] = useState<CaseStatus | 'all'>('open')
  const [activeCategory, setActiveCategory] = useState<CaseCategory | 'all'>('all')
  const [activeSort, setActiveSort] = useState<'newest' | 'supported'>('newest')
  const [showFilters, setShowFilters] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [selectedCase, setSelectedCase] = useState<OmbudsmanCase | null>(null)

  const offsetRef = useRef(0)
  const hasMore = cases.length < total

  useEffect(() => {
    createClient().then((sb) => sb.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)))
  }, [])

  const load = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true)
      offsetRef.current = 0
    } else {
      setLoadingMore(true)
    }
    setError('')

    try {
      const params = new URLSearchParams({
        status: activeStatus,
        sort: activeSort,
        limit: '20',
        offset: String(offsetRef.current),
      })
      if (activeCategory !== 'all') params.set('category', activeCategory)

      const res = await fetch(`/api/ombudsman?${params}`)
      if (!res.ok) throw new Error('Failed to load')
      const data: OmbudsmanResponse = await res.json()

      if (reset) {
        setCases(data.cases)
      } else {
        setCases((prev) => [...prev, ...data.cases])
      }
      setTotal(data.total)
      setOpenCount(data.open_count)
      setStats(data.stats)
      offsetRef.current += data.cases.length
    } catch {
      setError('Failed to load cases.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [activeStatus, activeCategory, activeSort])

  useEffect(() => { load(true) }, [load])

  const handleToggleSupport = useCallback(async (id: string) => {
    if (!userId) return
    try {
      const sb = await createClient()
      const { data } = await sb.rpc('toggle_ombudsman_support', { p_case_id: id })
      if (data && !data.error) {
        setCases((prev) => prev.map((c) =>
          c.id === id
            ? { ...c, support_count: data.support_count, user_supported: data.supported }
            : c
        ))
        if (selectedCase?.id === id) {
          setSelectedCase((prev) => prev ? { ...prev, support_count: data.support_count, user_supported: data.supported } : null)
        }
      }
    } catch { /* silent */ }
  }, [userId, selectedCase])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-20 pb-28">
        {/* Hero */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-for-500/10 rounded-lg border border-for-500/20">
              <Scale className="h-5 w-5 text-for-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Civic Ombudsman</h1>
          </div>
          <p className="text-sm text-surface-500 leading-relaxed">
            The independent oversight authority of Lobby Market. File formal complaints about
            process fairness, contested decisions, and civic integrity breaches. All cases are
            public. All findings are on record.
          </p>
        </div>

        {/* Stats */}
        <div className="flex gap-3 mb-5 flex-wrap">
          <StatPill label="Open" value={openCount} color="text-emerald" />
          <StatPill label="Under Review" value={stats.under_review} color="text-gold" />
          <StatPill label="Upheld" value={stats.upheld} color="text-for-400" />
          <StatPill label="Dismissed" value={stats.dismissed} color="text-surface-500" />
          <div className="flex-1" />
          {userId && (
            <Button onClick={() => setShowForm(true)} size="sm">
              <Scale className="h-4 w-4 mr-2" />
              File Case
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto scrollbar-hide">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveStatus(tab.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                activeStatus === tab.value
                  ? 'bg-for-500/20 text-for-300 border border-for-500/30'
                  : 'text-surface-500 hover:text-white'
              )}
            >
              {tab.label}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
              showFilters ? 'bg-surface-200 text-white' : 'text-surface-500 hover:text-white'
            )}
          >
            {showFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Filters
          </button>
        </div>

        {/* Expanded filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pb-4 flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setActiveCategory(opt.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                      activeCategory === opt.value
                        ? 'bg-surface-300 border-surface-400 text-white'
                        : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
                <div className="flex gap-1 ml-auto">
                  {(['newest', 'supported'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setActiveSort(s)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-colors',
                        activeSort === s
                          ? 'bg-surface-300 border-surface-400 text-white'
                          : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                      )}
                    >
                      {s === 'supported' ? 'Most Supported' : 'Newest'}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cases list */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-against-500/10 border border-against-500/30 rounded-xl mb-4">
            <AlertCircle className="h-4 w-4 text-against-400 shrink-0" />
            <p className="text-sm text-against-400">{error}</p>
            <button onClick={() => load(true)} className="ml-auto text-xs text-against-400 hover:text-white flex items-center gap-1">
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-xl" />
            ))}
          </div>
        ) : cases.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="No cases found"
            description={
              activeStatus === 'open'
                ? 'No open cases at this time. File the first formal complaint if there is a civic matter requiring independent review.'
                : 'No cases match the selected filters.'
            }
            action={userId ? { label: 'File a Case', onClick: () => setShowForm(true) } : undefined}
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {cases.map((c) => (
                <CaseCard
                  key={c.id}
                  caseItem={c}
                  userId={userId}
                  onToggleSupport={handleToggleSupport}
                  onSelect={setSelectedCase}
                />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Load more */}
        {!loading && hasMore && (
          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => load(false)}
              disabled={loadingMore}
            >
              {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load more'}
            </Button>
          </div>
        )}

        {/* Context note */}
        <div className="mt-8 p-4 bg-surface-200 rounded-xl border border-surface-300">
          <div className="flex gap-3">
            <Info className="h-4 w-4 text-surface-500 shrink-0 mt-0.5" />
            <div className="text-xs text-surface-500 space-y-1 leading-relaxed">
              <p className="font-semibold text-surface-400">About the Ombudsman</p>
              <p>
                The Civic Ombudsman is an independent authority separate from moderation and the
                Grand Council. It handles complaints about <em>process</em> — how decisions were
                made — not content violations (those go to /moderation) or argument quality (that
                is /tribunal).
              </p>
              <p>
                Cases are reviewed in order of public support and urgency. The Ombudsman&apos;s
                findings are formally recorded but non-punitive unless referred to moderation.
              </p>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />

      {/* Modals */}
      <AnimatePresence>
        {showForm && (
          <FileCaseForm
            onClose={() => setShowForm(false)}
            onSuccess={() => { setShowForm(false); load(true) }}
          />
        )}
        {selectedCase && (
          <CaseModal
            caseItem={selectedCase}
            userId={userId}
            onClose={() => setSelectedCase(null)}
            onToggleSupport={handleToggleSupport}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
