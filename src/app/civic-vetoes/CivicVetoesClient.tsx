'use client'

/**
 * /civic-vetoes — Civic Veto Challenges
 *
 * Citizens challenge established laws through collective democratic action.
 * When a veto gathers enough signatures (10% of original voters, min 50)
 * within 21 days, the law is queued for mandatory re-examination.
 *
 * Grounds types:
 *   unconstitutional — law violates core civic principles
 *   ineffective      — law has failed to produce intended outcomes
 *   harmful          — law is causing measurable civic harm
 *   outdated         — original context for the law no longer exists
 *   procedural       — voting integrity was compromised
 *
 * Distinct from:
 *   /civic-petitions     — citizen-initiated escalation (hearings, referendums)
 *   /laws                — full law codex (read-only)
 *   /civic-appeals       — formal appeals panel for specific decisions
 *   /law/[id]/reviews    — qualitative star-rating after a law passes
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Gavel,
  Loader2,
  Plus,
  RefreshCw,
  Scale,
  Shield,
  ThumbsDown,
  TimerOff,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CivicVetoEntry, CivicVetoesResponse, GroundsType, VetoStatus } from '@/app/api/civic-vetoes/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const GROUNDS_CONFIG: Record<
  GroundsType,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string; border: string; description: string }
> = {
  unconstitutional: {
    label: 'Unconstitutional',
    icon: Shield,
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    description: 'Violates core civic principles',
  },
  ineffective: {
    label: 'Ineffective',
    icon: ThumbsDown,
    color: 'text-surface-400',
    bg: 'bg-surface-300/30',
    border: 'border-surface-400/40',
    description: 'Failed to produce intended outcomes',
  },
  harmful: {
    label: 'Harmful',
    icon: AlertTriangle,
    color: 'text-against-300',
    bg: 'bg-against-600/10',
    border: 'border-against-600/30',
    description: 'Causing measurable civic harm',
  },
  outdated: {
    label: 'Outdated',
    icon: TimerOff,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    description: 'Original context no longer applies',
  },
  procedural: {
    label: 'Procedural',
    icon: Scale,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    description: 'Voting integrity was compromised',
  },
}

const STATUS_TABS: Array<{ id: string; label: string }> = [
  { id: 'open', label: 'Open' },
  { id: 'succeeded', label: 'Succeeded' },
  { id: 'failed', label: 'Failed' },
  { id: 'all', label: 'All' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function timeLeft(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor((diff % 86_400_000) / 3_600_000)
  if (d > 1) return `${d} days left`
  if (d === 1) return '1 day left'
  if (h > 0) return `${h}h left`
  return 'Expires soon'
}

function pctColor(pct: number): string {
  if (pct >= 100) return 'bg-for-500'
  if (pct >= 75) return 'bg-for-400'
  if (pct >= 50) return 'bg-gold'
  if (pct >= 25) return 'bg-against-400'
  return 'bg-against-500'
}

// ─── Veto Card ────────────────────────────────────────────────────────────────

function VetoCard({
  veto,
  onSign,
  onUnsign,
}: {
  veto: CivicVetoEntry
  onSign: (id: string) => Promise<void>
  onUnsign: (id: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [signing, setSigning] = useState(false)
  const [localCount, setLocalCount] = useState(veto.signature_count)
  const [localPct, setLocalPct] = useState(veto.pct_complete)
  const [localSigned, setLocalSigned] = useState(veto.user_has_signed)
  const [localStatus, setLocalStatus] = useState<VetoStatus>(veto.status)

  const cfg = GROUNDS_CONFIG[veto.grounds_type]
  const GroundsIcon = cfg.icon
  const isOpen = localStatus === 'open'
  const isSucceeded = localStatus === 'succeeded'
  const isFailed = localStatus === 'failed'

  async function handleToggleSign() {
    if (signing || !isOpen) return
    setSigning(true)
    try {
      if (localSigned) {
        await onUnsign(veto.id)
        const newCount = Math.max(0, localCount - 1)
        setLocalCount(newCount)
        setLocalPct(veto.target_signatures > 0 ? Math.min(100, Math.round((newCount / veto.target_signatures) * 100)) : 0)
        setLocalSigned(false)
      } else {
        await onSign(veto.id)
        const newCount = localCount + 1
        setLocalCount(newCount)
        const newPct = veto.target_signatures > 0 ? Math.min(100, Math.round((newCount / veto.target_signatures) * 100)) : 0
        setLocalPct(newPct)
        setLocalSigned(true)
        if (newCount >= veto.target_signatures) setLocalStatus('succeeded')
      }
    } finally {
      setSigning(false)
    }
  }

  const statusBadge =
    isSucceeded ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-for-500/20 text-for-300 border border-for-500/30">
        <Check className="h-2.5 w-2.5" /> SUCCEEDED
      </span>
    ) : isFailed ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-surface-300/40 text-surface-500 border border-surface-400/30">
        <X className="h-2.5 w-2.5" /> FAILED
      </span>
    ) : localStatus === 'withdrawn' ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-surface-300/40 text-surface-500 border border-surface-400/30">
        <Ban className="h-2.5 w-2.5" /> WITHDRAWN
      </span>
    ) : null

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'rounded-2xl border bg-surface-100 overflow-hidden transition-colors',
        isSucceeded ? 'border-for-500/30' : isFailed ? 'border-surface-400/20' : 'border-surface-300 hover:border-surface-400/60'
      )}
    >
      {/* Top: grounds badge + law link */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className={cn('flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl border', cfg.bg, cfg.border)}>
          <GroundsIcon className={cn('h-5 w-5', cfg.color)} aria-hidden />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border', cfg.bg, cfg.border, cfg.color)}>
              {cfg.label}
            </span>
            {statusBadge}
          </div>
          <p className="text-sm font-semibold text-white leading-snug">{veto.title}</p>
          {veto.law && (
            <Link
              href={`/law/${veto.law.id}`}
              className="mt-1 flex items-center gap-1 text-xs text-gold/80 hover:text-gold transition-colors font-mono"
            >
              <Gavel className="h-3 w-3 flex-shrink-0" aria-hidden />
              <span className="truncate">{veto.law.statement.slice(0, 70)}{veto.law.statement.length > 70 ? '…' : ''}</span>
            </Link>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between text-xs font-mono text-surface-500 mb-1.5">
          <span>
            <span className={cn('font-bold', localPct >= 100 ? 'text-for-300' : 'text-white')}>
              {localCount.toLocaleString()}
            </span>
            {' / '}
            {veto.target_signatures.toLocaleString()} signatures
          </span>
          <span className={cn(localPct >= 100 ? 'text-for-300' : '')}>{localPct}%</span>
        </div>
        <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full transition-colors', pctColor(localPct))}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, localPct)}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Grounds preview / expand */}
      <div className="px-4 pb-3">
        <p className={cn('text-xs text-surface-600 leading-relaxed', !expanded && 'line-clamp-2')}>
          {veto.grounds}
        </p>
        {veto.grounds.length > 160 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 flex items-center gap-1 text-[11px] text-surface-500 hover:text-surface-300 transition-colors font-mono"
            aria-expanded={expanded}
          >
            {expanded ? (
              <><ChevronUp className="h-3 w-3" aria-hidden />Show less</>
            ) : (
              <><ChevronDown className="h-3 w-3" aria-hidden />Read full grounds</>
            )}
          </button>
        )}
      </div>

      {/* Footer: challenger + time + sign */}
      <div className="px-4 py-3 border-t border-surface-300/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {veto.challenger ? (
            <Link href={`/profile/${veto.challenger.username}`} className="flex items-center gap-1.5 min-w-0">
              <Avatar
                src={veto.challenger.avatar_url}
                fallback={veto.challenger.display_name || veto.challenger.username}
                size="xs"
              />
              <span className="text-[11px] font-mono text-surface-500 truncate">
                @{veto.challenger.username}
              </span>
            </Link>
          ) : (
            <span className="text-[11px] font-mono text-surface-500">Anonymous</span>
          )}
          <span className="text-surface-600" aria-hidden>·</span>
          <span className="text-[11px] font-mono text-surface-500 flex items-center gap-1 flex-shrink-0">
            <Clock className="h-3 w-3" aria-hidden />
            {isOpen ? timeLeft(veto.closes_at) : relativeTime(veto.created_at)}
          </span>
        </div>

        {isOpen && (
          <button
            onClick={handleToggleSign}
            disabled={signing}
            aria-label={localSigned ? 'Remove signature' : 'Sign this veto'}
            className={cn(
              'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
              'border transition-all disabled:opacity-60',
              localSigned
                ? 'bg-for-600/20 border-for-600/40 text-for-300 hover:bg-against-600/20 hover:border-against-600/40 hover:text-against-300'
                : 'bg-against-600/20 border-against-600/40 text-against-300 hover:bg-against-600/30'
            )}
          >
            {signing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : localSigned ? (
              <Check className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Users className="h-3.5 w-3.5" aria-hidden />
            )}
            {localSigned ? 'Signed' : 'Sign'}
          </button>
        )}

        {isSucceeded && (
          <span className="flex-shrink-0 flex items-center gap-1 text-[11px] font-mono text-for-300">
            <Zap className="h-3 w-3" aria-hidden /> Threshold reached
          </span>
        )}
      </div>
    </motion.article>
  )
}

// ─── Skeleton cards ───────────────────────────────────────────────────────────

function VetoSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <Skeleton className="h-8 w-full rounded-lg" />
    </div>
  )
}

// ─── Create Veto Modal ────────────────────────────────────────────────────────

interface CreateVetoModalProps {
  onClose: () => void
  onCreated: () => void
}

const GROUNDS_TYPE_OPTIONS: Array<{ id: GroundsType; label: string; description: string }> = [
  { id: 'ineffective', label: 'Ineffective', description: 'Law has failed to achieve its stated goals' },
  { id: 'harmful', label: 'Harmful', description: 'Law is causing measurable civic harm' },
  { id: 'outdated', label: 'Outdated', description: 'Original context no longer applies' },
  { id: 'unconstitutional', label: 'Unconstitutional', description: 'Violates core civic principles' },
  { id: 'procedural', label: 'Procedural Error', description: 'Voting integrity was compromised' },
]

function CreateVetoModal({ onClose, onCreated }: CreateVetoModalProps) {
  const [step, setStep] = useState<'law' | 'form'>('law')
  const [lawSearch, setLawSearch] = useState('')
  const [lawResults, setLawResults] = useState<Array<{ id: string; statement: string; category: string | null; total_votes: number }>>([])
  const [lawSearching, setLawSearching] = useState(false)
  const [selectedLaw, setSelectedLaw] = useState<{ id: string; statement: string; total_votes: number } | null>(null)
  const [title, setTitle] = useState('')
  const [grounds, setGrounds] = useState('')
  const [groundsType, setGroundsType] = useState<GroundsType>('ineffective')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current)
    if (lawSearch.trim().length < 3) { setLawResults([]); return }
    setLawSearching(true)
    searchRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/laws/search?q=${encodeURIComponent(lawSearch)}&limit=8`)
        const data = res.ok ? await res.json() : null
        setLawResults(data?.results ?? [])
      } catch { setLawResults([]) }
      setLawSearching(false)
    }, 350)
  }, [lawSearch])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedLaw) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/civic-vetoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ law_id: selectedLaw.id, title, grounds, grounds_type: groundsType }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg: Record<string, string> = {
          title_length: 'Title must be 10–150 characters.',
          grounds_length: 'Grounds statement must be 30–2000 characters.',
          law_not_found: 'Law not found.',
          not_authenticated: 'You must be signed in.',
        }
        setError(msg[data.error] ?? data.error ?? 'Something went wrong.')
        return
      }
      onCreated()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="File a Civic Veto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="w-full max-w-lg bg-surface-100 border border-surface-300 rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-300">
          <div className="flex items-center gap-2">
            <Ban className="h-4 w-4 text-against-300" aria-hidden />
            <h2 className="font-mono text-sm font-bold text-white">File a Civic Veto</h2>
          </div>
          <button onClick={onClose} className="text-surface-500 hover:text-white transition-colors" aria-label="Close">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="p-5">
          {step === 'law' ? (
            <div className="space-y-4">
              <p className="text-xs font-mono text-surface-500">
                Search for the established law you want to challenge.
              </p>
              <input
                type="text"
                value={lawSearch}
                onChange={(e) => setLawSearch(e.target.value)}
                placeholder="Search laws by keyword…"
                className="w-full bg-surface-200 border border-surface-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-against-400 transition-colors"
                autoFocus
              />
              {lawSearching && (
                <div className="flex justify-center py-2">
                  <Loader2 className="h-5 w-5 animate-spin text-surface-500" aria-hidden />
                </div>
              )}
              {lawResults.length > 0 && (
                <ul className="space-y-2 max-h-48 overflow-y-auto" role="listbox" aria-label="Law search results">
                  {lawResults.map((law) => (
                    <li key={law.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selectedLaw?.id === law.id}
                        onClick={() => { setSelectedLaw(law); setStep('form') }}
                        className="w-full text-left px-3 py-2.5 rounded-xl bg-surface-200 border border-surface-300 hover:border-against-400/50 hover:bg-surface-200/80 transition-colors"
                      >
                        <p className="text-xs font-semibold text-white leading-snug">{law.statement.slice(0, 100)}{law.statement.length > 100 ? '…' : ''}</p>
                        <p className="text-[10px] font-mono text-gold mt-0.5 flex items-center gap-1">
                          <Gavel className="h-2.5 w-2.5" aria-hidden />
                          {law.category ?? 'General'} · {law.total_votes.toLocaleString()} votes
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {lawSearch.trim().length >= 3 && !lawSearching && lawResults.length === 0 && (
                <p className="text-xs font-mono text-surface-500 text-center py-2">No laws found matching &ldquo;{lawSearch}&rdquo;</p>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-start gap-2 p-3 rounded-xl bg-gold/10 border border-gold/30">
                <Gavel className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" aria-hidden />
                <div className="min-w-0">
                  <p className="text-xs font-mono text-gold font-semibold">Challenging law:</p>
                  <p className="text-xs text-white leading-snug mt-0.5">{selectedLaw?.statement.slice(0, 120)}{(selectedLaw?.statement.length ?? 0) > 120 ? '…' : ''}</p>
                </div>
                <button type="button" onClick={() => setStep('law')} className="flex-shrink-0 text-surface-500 hover:text-white" aria-label="Change law">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div>
                <label htmlFor="veto-title" className="block text-xs font-mono text-surface-500 mb-1.5">
                  Veto Title <span className="text-against-300">*</span>
                </label>
                <input
                  id="veto-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Reconsider enforcement mechanisms"
                  maxLength={150}
                  required
                  className="w-full bg-surface-200 border border-surface-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-against-400 transition-colors"
                />
                <p className="text-[10px] font-mono text-surface-600 mt-1">{title.length}/150</p>
              </div>

              <div>
                <p className="text-xs font-mono text-surface-500 mb-2">
                  Grounds Type <span className="text-against-300">*</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {GROUNDS_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setGroundsType(opt.id)}
                      className={cn(
                        'text-left px-3 py-2 rounded-xl border text-xs transition-all',
                        groundsType === opt.id
                          ? 'bg-against-600/20 border-against-500/40 text-against-200'
                          : 'bg-surface-200 border-surface-300 text-surface-600 hover:border-surface-400'
                      )}
                    >
                      <p className="font-semibold">{opt.label}</p>
                      <p className="text-[10px] mt-0.5 opacity-70">{opt.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="veto-grounds" className="block text-xs font-mono text-surface-500 mb-1.5">
                  Grounds Statement <span className="text-against-300">*</span>
                </label>
                <textarea
                  id="veto-grounds"
                  value={grounds}
                  onChange={(e) => setGrounds(e.target.value)}
                  placeholder="Make the case for why this law should be reconsidered. Include evidence, impact, or procedural concerns (30–2000 characters)."
                  maxLength={2000}
                  required
                  rows={5}
                  className="w-full bg-surface-200 border border-surface-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-against-400 transition-colors resize-none"
                />
                <p className="text-[10px] font-mono text-surface-600 mt-1">{grounds.length}/2000</p>
              </div>

              {error && (
                <p className="text-xs font-mono text-against-300 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {error}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setStep('law')}
                  className="flex-1 py-2.5 rounded-xl border border-surface-300 text-sm font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting || title.length < 10 || grounds.length < 30}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl',
                    'text-sm font-mono font-semibold transition-all',
                    'bg-against-600/30 border border-against-500/50 text-against-200',
                    'hover:bg-against-600/50 disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Ban className="h-4 w-4" aria-hidden />}
                  File Veto
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CivicVetoesClient() {
  const [tab, setTab] = useState<string>('open')
  const [vetoes, setVetoes] = useState<CivicVetoEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const fetchVetoes = useCallback(async (status: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch(`/api/civic-vetoes?status=${status}&limit=30`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = (await res.json()) as CivicVetoesResponse
      setVetoes(data.vetoes)
      setTotal(data.total)
    } catch {
      setVetoes([])
      setTotal(0)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchVetoes(tab)
  }, [tab, fetchVetoes])

  async function handleSign(id: string) {
    const res = await fetch(`/api/civic-vetoes/${id}/sign`, { method: 'POST' })
    if (!res.ok) throw new Error('Sign failed')
  }

  async function handleUnsign(id: string) {
    const res = await fetch(`/api/civic-vetoes/${id}/sign`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Unsign failed')
  }

  function handleCreated() {
    setShowCreate(false)
    fetchVetoes('open', true)
    setTab('open')
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
              <Ban className="h-5 w-5 text-against-300" aria-hidden />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Vetoes</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Democratic override of established laws
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => fetchVetoes(tab, true)}
              disabled={refreshing}
              aria-label="Refresh vetoes"
              className="p-2 rounded-lg border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden />
            </button>
            <Button
              size="sm"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5"
              aria-label="File a new civic veto"
            >
              <Plus className="h-4 w-4" aria-hidden />
              File Veto
            </Button>
          </div>
        </div>

        {/* How it works */}
        <div className="mb-6 p-4 rounded-2xl bg-surface-100 border border-surface-300">
          <p className="text-xs font-mono text-surface-500 leading-relaxed">
            <span className="text-white font-semibold">How it works:</span>{' '}
            Gather signatures from{' '}
            <span className="text-against-300 font-semibold">10% of the law&apos;s original voters</span>{' '}
            (minimum 50) within{' '}
            <span className="text-gold font-semibold">21 days</span>.{' '}
            A successful veto queues the law for mandatory re-examination through a new community vote.
          </p>
        </div>

        {/* Status tabs */}
        <div
          className="flex gap-2 mb-6 overflow-x-auto no-scrollbar"
          role="tablist"
          aria-label="Veto status filter"
        >
          {STATUS_TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-mono font-semibold border transition-all',
                tab === t.id
                  ? 'bg-against-600/30 border-against-500/50 text-against-200'
                  : 'bg-surface-100 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white'
              )}
            >
              {t.label}
              {t.id === tab && total > 0 && (
                <span className="ml-1.5 text-[10px] opacity-70">{total}</span>
              )}
            </button>
          ))}
        </div>

        {/* Veto list */}
        <div className="space-y-4" role="list" aria-label="Civic vetoes">
          <AnimatePresence mode="popLayout">
            {loading ? (
              [1, 2, 3].map((i) => <VetoSkeleton key={i} />)
            ) : vetoes.length === 0 ? (
              <EmptyState
                icon={Ban}
                title={tab === 'open' ? 'No open vetoes' : `No ${tab} vetoes`}
                description={
                  tab === 'open'
                    ? 'No laws are currently being challenged. File a veto if you believe an established law should be reconsidered.'
                    : `There are no ${tab} veto challenges at this time.`
                }
                actions={
                  tab === 'open'
                    ? [{ label: 'File a Veto', onClick: () => setShowCreate(true) }]
                    : undefined
                }
              />
            ) : (
              vetoes.map((veto) => (
                <div key={veto.id} role="listitem">
                  <VetoCard veto={veto} onSign={handleSign} onUnsign={handleUnsign} />
                </div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Law codex link */}
        <div className="mt-8 text-center">
          <Link
            href="/laws"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-gold transition-colors"
          >
            <Gavel className="h-3.5 w-3.5" aria-hidden />
            Browse established laws
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </main>

      <BottomNav />

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateVetoModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
        )}
      </AnimatePresence>
    </div>
  )
}
