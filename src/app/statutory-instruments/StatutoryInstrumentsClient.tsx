'use client'

/**
 * /statutory-instruments — Secondary Legislation Chamber
 *
 * Statutory Instruments are legal instruments made by ministers
 * (coalition leaders / high-rep citizens) using powers delegated
 * in primary legislation (established Laws or enacted Bills).
 *
 * Two procedures:
 *   Negative   — laid for 40 days; comes into force unless parliament
 *                prays against it (motions of annulment)
 *   Affirmative — must receive explicit parliamentary approval (vote)
 *
 * Citizens can:
 *   • Table a prayer of annulment against a negative SI
 *   • Second an existing prayer to push it toward a debate
 *   • Vote Yes / No / Abstain on affirmative SIs
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Book,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Landmark,
  Loader2,
  MinusCircle,
  Plus,
  RefreshCw,
  Scale,
  ScrollText,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Vote,
  X,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  StatutoryInstrument,
  SIListResponse,
  SIProcedure,
  SIStatus,
} from '@/app/api/statutory-instruments/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTERS = [
  { id: 'active',   label: 'Active / Laid', icon: Timer },
  { id: 'force',    label: 'In Force',      icon: CheckCircle2 },
  { id: 'resolved', label: 'Resolved',      icon: Scale },
  { id: 'all',      label: 'All',           icon: ScrollText },
] as const

const PROCEDURE_CONFIG: Record<SIProcedure, {
  label: string; bg: string; text: string; border: string; description: string
}> = {
  negative: {
    label: 'Negative Procedure',
    bg: 'bg-for-500/10',
    text: 'text-for-400',
    border: 'border-for-500/30',
    description: 'Takes effect automatically after 40 days unless parliament prays against it.',
  },
  affirmative: {
    label: 'Affirmative Procedure',
    bg: 'bg-purple/10',
    text: 'text-purple',
    border: 'border-purple/30',
    description: 'Requires explicit approval by parliamentary vote before coming into force.',
  },
  super_affirmative: {
    label: 'Super-Affirmative',
    bg: 'bg-gold/10',
    text: 'text-gold',
    border: 'border-gold/30',
    description: 'Highest scrutiny — draft must be approved, then re-laid and approved again.',
  },
}

const STATUS_CONFIG: Record<SIStatus, {
  label: string; icon: typeof CheckCircle2; text: string; bg: string; border: string
}> = {
  draft:     { label: 'Draft',         icon: FileText,     text: 'text-surface-500', bg: 'bg-surface-300/30', border: 'border-surface-400/30' },
  laid:      { label: 'Laid',          icon: Timer,        text: 'text-for-300',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  in_force:  { label: 'In Force',      icon: CheckCircle2, text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  annulled:  { label: 'Annulled',      icon: XCircle,      text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  approved:  { label: 'Approved',      icon: CheckCircle2, text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  rejected:  { label: 'Rejected',      icon: XCircle,      text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  withdrawn: { label: 'Withdrawn',     icon: MinusCircle,  text: 'text-surface-500', bg: 'bg-surface-300/30', border: 'border-surface-400/30' },
}

const CATEGORY_COLORS: Record<string, string> = {
  Politics:    'text-for-400',
  Economics:   'text-gold',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-400',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2)  return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return formatDate(iso)
}

// ─── Prayer Modal ──────────────────────────────────────────────────────────────

function PrayerModal({
  si,
  onClose,
  onSubmit,
}: {
  si: StatutoryInstrument
  onClose: () => void
  onSubmit: (text: string) => Promise<void>
}) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (text.trim().length < 10) { setError('Prayer must be at least 10 characters'); return }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(text.trim())
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to table prayer')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="w-full max-w-lg bg-surface-100 border border-surface-300 rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-mono font-bold text-lg text-white">Table a Prayer</h2>
            <p className="text-xs font-mono text-surface-500 mt-0.5">Motion to Annul — {si.reference}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-200 transition-colors">
            <X className="h-4 w-4 text-surface-500" />
          </button>
        </div>

        <p className="text-sm text-surface-600 mb-4">
          A prayer of annulment is a formal parliamentary motion objecting to this Statutory Instrument.
          If your prayer receives <span className="text-white font-semibold">20+ seconds</span>, it triggers a formal vote to annul the SI.
        </p>

        <div className="bg-surface-200/50 border border-surface-300 rounded-xl p-3 mb-4">
          <p className="text-xs font-mono text-surface-500 mb-1">SI being challenged</p>
          <p className="text-sm text-white font-semibold">{si.short_title}</p>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="State your grounds for seeking annulment of this instrument..."
          rows={4}
          className="w-full bg-surface-200 border border-surface-300 rounded-xl px-4 py-3 text-sm text-white placeholder:text-surface-500 font-mono resize-none focus:outline-none focus:border-for-500/60 transition-colors"
        />

        {error && (
          <p className="mt-2 text-xs text-against-400 font-mono">{error}</p>
        )}

        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-surface-300 text-sm font-mono text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || text.trim().length < 10}
            className={cn(
              'flex-1 h-10 rounded-xl text-sm font-mono font-semibold flex items-center justify-center gap-2 transition-all',
              'bg-against-600 hover:bg-against-500 text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Vote className="h-4 w-4" />}
            Table Prayer
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── SI Card ─────────────────────────────────────────────────────────────────

function SICard({
  si,
  onPrayer,
  onSecond,
  onVote,
}: {
  si: StatutoryInstrument
  onPrayer: (si: StatutoryInstrument) => void
  onSecond: (siId: string, prayerId: string) => Promise<void>
  onVote: (siId: string, vote: 'yes' | 'no' | 'abstain') => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [votingInProgress, setVotingInProgress] = useState<string | null>(null)

  const proc = PROCEDURE_CONFIG[si.procedure]
  const statusCfg = STATUS_CONFIG[si.status]
  const StatusIcon = statusCfg.icon
  const catColor = CATEGORY_COLORS[si.category] ?? 'text-surface-500'

  const isActive   = si.status === 'laid'
  const isNegative = si.procedure === 'negative'
  const isAffirmative = si.procedure === 'affirmative'

  const totalVotes = si.yes_votes + si.no_votes
  const yesPct = totalVotes > 0 ? Math.round((si.yes_votes / totalVotes) * 100) : 0
  const noPct  = totalVotes > 0 ? Math.round((si.no_votes  / totalVotes) * 100) : 0

  async function handleVote(vote: 'yes' | 'no' | 'abstain') {
    if (votingInProgress) return
    setVotingInProgress(vote)
    try {
      await onVote(si.id, vote)
    } finally {
      setVotingInProgress(null)
    }
  }

  async function handleSecond(prayerId: string) {
    if (votingInProgress) return
    setVotingInProgress(`second-${prayerId}`)
    try {
      await onSecond(si.id, prayerId)
    } finally {
      setVotingInProgress(null)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-100 border border-surface-300 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className={cn('flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center border', proc.bg, proc.border)}>
            <ScrollText className={cn('h-5 w-5', proc.text)} />
          </div>

          <div className="flex-1 min-w-0">
            {/* Reference + status */}
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="text-xs font-mono text-surface-500">{si.reference}</span>
              <span className={cn('inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full border', statusCfg.text, statusCfg.bg, statusCfg.border)}>
                <StatusIcon className="h-3 w-3" />
                {statusCfg.label}
              </span>
              <span className={cn('text-xs font-mono px-2 py-0.5 rounded-full border', proc.text, proc.bg, proc.border)}>
                {si.procedure === 'negative' ? 'Neg.' : si.procedure === 'affirmative' ? 'Aff.' : 'Super-Aff.'}
              </span>
              <span className={cn('text-xs font-mono font-semibold', catColor)}>{si.category}</span>
            </div>

            {/* Title */}
            <h3 className="font-mono font-bold text-white text-sm leading-snug mb-2">
              {si.short_title}
            </h3>

            {/* Description */}
            <p className={cn('text-sm text-surface-600 leading-relaxed', !expanded && 'line-clamp-2')}>
              {si.description}
            </p>
            {si.description.length > 120 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-1 text-xs font-mono text-for-400 hover:text-for-300 flex items-center gap-1 transition-colors"
              >
                {expanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Read more</>}
              </button>
            )}
          </div>
        </div>

        {/* Maker + timing */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-surface-200">
          <div className="flex items-center gap-2">
            <Avatar
              src={si.maker.avatar_url ?? undefined}
              username={si.maker.username}
              size="xs"
            />
            <Link href={`/profile/${si.maker.username}`} className="text-xs font-mono text-surface-500 hover:text-white transition-colors">
              {si.maker.display_name ?? si.maker.username}
            </Link>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-surface-500">
            {si.laid_at && (
              <span className="flex items-center gap-1">
                <Book className="h-3 w-3" />
                Laid {relativeTime(si.laid_at)}
              </span>
            )}
            {isActive && isNegative && si.days_remaining !== null && (
              <span className={cn(
                'flex items-center gap-1 font-semibold',
                si.days_remaining <= 7 ? 'text-against-400' : si.days_remaining <= 14 ? 'text-gold' : 'text-surface-500'
              )}>
                <Clock className="h-3 w-3" />
                {si.days_remaining}d remaining
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Affirmative vote bar */}
      {si.procedure === 'affirmative' && totalVotes > 0 && (
        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono text-emerald">{yesPct}% Yes</span>
            <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
              <div
                className="h-full bg-emerald rounded-full transition-all"
                style={{ width: `${yesPct}%` }}
              />
            </div>
            <span className="text-xs font-mono text-against-400">{noPct}% No</span>
          </div>
          <p className="text-[11px] font-mono text-surface-500 text-right">{totalVotes.toLocaleString()} votes cast</p>
        </div>
      )}

      {/* Actions: affirmative voting */}
      {isActive && isAffirmative && (
        <div className="px-5 pb-4 flex gap-2">
          {(['yes', 'no', 'abstain'] as const).map((v) => (
            <button
              key={v}
              onClick={() => handleVote(v)}
              disabled={!!votingInProgress || si.user_has_voted === v}
              className={cn(
                'flex-1 h-9 rounded-xl text-xs font-mono font-semibold flex items-center justify-center gap-1.5 border transition-all',
                si.user_has_voted === v
                  ? v === 'yes' ? 'bg-emerald/20 border-emerald/40 text-emerald'
                    : v === 'no' ? 'bg-against-500/20 border-against-500/40 text-against-400'
                    : 'bg-surface-300/50 border-surface-400/40 text-surface-400'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 disabled:opacity-40'
              )}
            >
              {votingInProgress === v ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : v === 'yes' ? (
                <><ThumbsUp className="h-3.5 w-3.5" /> Aye</>
              ) : v === 'no' ? (
                <><ThumbsDown className="h-3.5 w-3.5" /> No</>
              ) : (
                <><MinusCircle className="h-3.5 w-3.5" /> Abstain</>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Actions: negative — prayers */}
      {isActive && isNegative && (
        <div className="px-5 pb-4">
          {/* Existing prayers */}
          {si.prayers.length > 0 && (
            <div className="mb-3 space-y-2">
              {si.prayers.slice(0, 2).map((prayer) => (
                <div
                  key={prayer.id}
                  className="bg-against-500/5 border border-against-500/20 rounded-xl p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Avatar
                          src={prayer.author.avatar_url ?? undefined}
                          username={prayer.author.username}
                          size="xs"
                        />
                        <span className="text-xs font-mono text-surface-500">
                          {prayer.author.display_name ?? prayer.author.username}
                        </span>
                        <span className={cn(
                          'text-[10px] font-mono px-1.5 py-0.5 rounded-full',
                          prayer.seconds_count >= 20
                            ? 'bg-against-500/20 text-against-400 border border-against-500/30'
                            : 'bg-surface-300/40 text-surface-500'
                        )}>
                          {prayer.seconds_count} {prayer.seconds_count === 1 ? 'second' : 'seconds'}
                          {prayer.seconds_count >= 20 && ' — TRIGGERS VOTE'}
                        </span>
                      </div>
                      <p className="text-xs text-surface-600 leading-relaxed">{prayer.prayer_text}</p>
                    </div>
                    {!prayer.user_has_seconded && (
                      <button
                        onClick={() => handleSecond(prayer.id)}
                        disabled={!!votingInProgress}
                        className="flex-shrink-0 h-8 px-3 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:bg-surface-300 disabled:opacity-40 transition-all flex items-center gap-1"
                      >
                        {votingInProgress === `second-${prayer.id}` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5" />
                            Second
                          </>
                        )}
                      </button>
                    )}
                    {prayer.user_has_seconded && (
                      <span className="flex-shrink-0 h-8 px-3 flex items-center gap-1 text-xs font-mono text-emerald">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Seconded
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Table prayer button */}
          {!si.user_has_prayed && (
            <button
              onClick={() => onPrayer(si)}
              className="w-full h-9 rounded-xl bg-against-600/20 border border-against-500/30 text-xs font-mono text-against-400 hover:bg-against-600/30 hover:text-against-300 flex items-center justify-center gap-1.5 transition-all"
            >
              <Vote className="h-3.5 w-3.5" />
              Table Prayer of Annulment
            </button>
          )}

          {si.user_has_prayed && (
            <div className="text-xs font-mono text-against-400/70 text-center py-1">
              Prayer tabled — awaiting seconds
            </div>
          )}
        </div>
      )}

      {/* Resolved state info */}
      {(si.status === 'in_force' || si.status === 'approved') && si.in_force_at && (
        <div className="px-5 pb-4">
          <div className="bg-emerald/5 border border-emerald/20 rounded-xl px-4 py-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald flex-shrink-0" />
            <span className="text-xs font-mono text-emerald">
              In force since {formatDate(si.in_force_at)}
            </span>
          </div>
        </div>
      )}

      {(si.status === 'annulled' || si.status === 'rejected') && (
        <div className="px-5 pb-4">
          <div className="bg-against-500/5 border border-against-500/20 rounded-xl px-4 py-2 flex items-center gap-2">
            <XCircle className="h-4 w-4 text-against-400 flex-shrink-0" />
            <span className="text-xs font-mono text-against-400">
              {si.status === 'annulled' ? 'Annulled by parliament' : 'Rejected — vote failed'}
            </span>
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ─── New SI Form ──────────────────────────────────────────────────────────────

function NewSIForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [shortTitle, setShortTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Politics')
  const [procedure, setProcedure] = useState<SIProcedure>('negative')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const CATEGORIES = ['Economics', 'Politics', 'Technology', 'Science', 'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education']

  async function handleSubmit() {
    if (shortTitle.trim().length < 5) { setError('Title must be at least 5 characters'); return }
    if (description.trim().length < 20) { setError('Description must be at least 20 characters'); return }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/statutory-instruments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ short_title: shortTitle, description, category, procedure }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Failed to create')
      }
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Statutory Instrument')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="w-full max-w-xl bg-surface-100 border border-surface-300 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-mono font-bold text-xl text-white">Lay a Statutory Instrument</h2>
            <p className="text-xs font-mono text-surface-500 mt-0.5">Secondary legislation under delegated authority</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-200 transition-colors">
            <X className="h-4 w-4 text-surface-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-surface-500 mb-1.5">Short Title *</label>
            <input
              type="text"
              value={shortTitle}
              onChange={(e) => setShortTitle(e.target.value)}
              placeholder="e.g. Civic Debate Duration (Extension) Order 2024"
              maxLength={120}
              className="w-full bg-surface-200 border border-surface-300 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-surface-500 font-mono focus:outline-none focus:border-for-500/60 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-surface-500 mb-1.5">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain what this instrument does and its legal basis..."
              rows={4}
              maxLength={1000}
              className="w-full bg-surface-200 border border-surface-300 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-surface-500 font-mono resize-none focus:outline-none focus:border-for-500/60 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-surface-500 mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-for-500/60 transition-colors"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-surface-500 mb-1.5">Procedure</label>
              <select
                value={procedure}
                onChange={(e) => setProcedure(e.target.value as SIProcedure)}
                className="w-full bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-for-500/60 transition-colors"
              >
                <option value="negative">Negative</option>
                <option value="affirmative">Affirmative</option>
                <option value="super_affirmative">Super-Affirmative</option>
              </select>
            </div>
          </div>

          {/* Procedure explanation */}
          <div className={cn('rounded-xl p-3 border text-xs font-mono', PROCEDURE_CONFIG[procedure].bg, PROCEDURE_CONFIG[procedure].border, PROCEDURE_CONFIG[procedure].text)}>
            {PROCEDURE_CONFIG[procedure].description}
          </div>

          {error && (
            <p className="text-xs text-against-400 font-mono">{error}</p>
          )}

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-surface-300 text-sm font-mono text-surface-500 hover:text-white hover:bg-surface-200 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 h-10 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScrollText className="h-4 w-4" />}
              Lay Instrument
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function StatutoryInstrumentsClient() {
  const [data, setData] = useState<SIListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('active')
  const [prayerTarget, setPrayerTarget] = useState<StatutoryInstrument | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const loadData = useCallback(async (f: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/statutory-instruments?filter=${f}`)
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as SIListResponse
      setData(json)
    } catch {
      setData({ items: [], filter: f })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData(filter)
  }, [filter, loadData, refreshKey])

  async function handlePrayer(text: string) {
    if (!prayerTarget) return
    const res = await fetch('/api/statutory-instruments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'prayer', si_id: prayerTarget.id, prayer_text: text }),
    })
    if (!res.ok) {
      const body = await res.json() as { error?: string }
      throw new Error(body.error ?? 'Failed')
    }
    setRefreshKey((k) => k + 1)
  }

  async function handleSecond(siId: string, prayerId: string) {
    const res = await fetch('/api/statutory-instruments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'second', si_id: siId, prayer_id: prayerId }),
    })
    if (!res.ok) {
      const body = await res.json() as { error?: string }
      throw new Error(body.error ?? 'Failed')
    }
    setRefreshKey((k) => k + 1)
  }

  async function handleVote(siId: string, vote: 'yes' | 'no' | 'abstain') {
    const res = await fetch('/api/statutory-instruments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'vote', si_id: siId, vote }),
    })
    if (!res.ok) {
      const body = await res.json() as { error?: string }
      throw new Error(body.error ?? 'Failed')
    }
    setRefreshKey((k) => k + 1)
  }

  const items = data?.items ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* Hero header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/parliament" className="p-2 rounded-xl hover:bg-surface-200 transition-colors">
              <ArrowLeft className="h-4 w-4 text-surface-500" />
            </Link>
            <div>
              <h1 className="font-mono font-bold text-2xl text-white">Statutory Instruments</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Secondary legislation under delegated authority
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-xl bg-for-600 hover:bg-for-500 text-white text-xs font-mono font-semibold transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Lay SI
          </button>
        </div>

        {/* Explainer */}
        <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Landmark className="h-4 w-4 text-gold flex-shrink-0" />
            <span className="text-xs font-mono font-semibold text-gold uppercase tracking-wide">How SIs Work</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-mono font-semibold text-for-400">Negative Procedure</p>
              <p className="text-xs text-surface-600">Laid for <strong className="text-white">40 days</strong>. Takes effect automatically unless parliament tables a successful Prayer of Annulment (requires 20+ seconds to trigger a vote).</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-mono font-semibold text-purple">Affirmative Procedure</p>
              <p className="text-xs text-surface-600">Requires <strong className="text-white">explicit parliamentary approval</strong> before coming into force. Citizens vote Aye or No within the laid period.</p>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-4 mb-5 overflow-x-auto pb-2">
          {FILTERS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={cn(
                'flex-shrink-0 flex items-center gap-1.5 h-9 px-4 rounded-xl border text-xs font-mono font-semibold transition-all',
                filter === id
                  ? 'bg-for-500/20 border-for-500/40 text-for-300'
                  : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white hover:bg-surface-200'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            className="flex-shrink-0 flex items-center gap-1 h-9 px-3 rounded-xl border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-200 text-xs transition-all disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-2xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No Statutory Instruments"
            description={
              filter === 'active'
                ? 'No instruments are currently laid before parliament. High-standing citizens can lay new SIs.'
                : 'No instruments found for this filter.'
            }
            action={{ label: 'Lay an Instrument', href: '#', onClick: () => setShowNewForm(true) }}
          />
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {items.map((si) => (
                <SICard
                  key={si.id}
                  si={si}
                  onPrayer={setPrayerTarget}
                  onSecond={handleSecond}
                  onVote={handleVote}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Related links */}
        <div className="mt-8 pt-6 border-t border-surface-200">
          <p className="text-xs font-mono text-surface-500 mb-3">Related parliamentary procedure</p>
          <div className="flex flex-wrap gap-2">
            {[
              { href: '/bills', label: 'Primary Legislation', icon: FileText },
              { href: '/parliament', label: 'The Parliament', icon: Landmark },
              { href: '/divisions', label: 'Divisions', icon: Vote },
              { href: '/amendments', label: 'Bill Amendments', icon: Scale },
              { href: '/committees', label: 'Select Committees', icon: Shield },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-surface-100 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:bg-surface-200 transition-all"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />

      {/* Modals */}
      <AnimatePresence>
        {prayerTarget && (
          <PrayerModal
            si={prayerTarget}
            onClose={() => setPrayerTarget(null)}
            onSubmit={handlePrayer}
          />
        )}
        {showNewForm && (
          <NewSIForm
            onClose={() => setShowNewForm(false)}
            onCreated={() => setRefreshKey((k) => k + 1)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
