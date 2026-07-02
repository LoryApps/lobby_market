'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Gavel,
  Loader2,
  Plus,
  RefreshCw,
  Scale,
  ScrollText,
  Users,
  Vote,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  CivicPetitionEntry,
  CivicPetitionsResponse,
  ActionType,
} from '@/app/api/civic-petitions/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<
  ActionType,
  { label: string; icon: typeof Gavel; color: string; bg: string; border: string; description: string }
> = {
  hearing: {
    label: 'Hearing',
    icon: Gavel,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    description: 'Forces a formal committee hearing with expert testimony',
  },
  referendum: {
    label: 'Referendum',
    icon: Vote,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    description: 'Triggers a direct citizen vote on this issue',
  },
  assembly: {
    label: 'Assembly',
    icon: Users,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    description: 'Convenes a Citizens Assembly for deliberation',
  },
  review: {
    label: 'Review',
    icon: Scale,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    description: 'Demands a formal policy review',
  },
}

const STATUS_TABS: Array<{ id: string; label: string }> = [
  { id: 'open', label: 'Open' },
  { id: 'fulfilled', label: 'Fulfilled' },
  { id: 'expired', label: 'Expired' },
  { id: 'all', label: 'All' },
]

const COMMITTEES = [
  'Economic Policy',
  'Technology & Innovation',
  'Environment & Climate',
  'Health & Welfare',
  'Justice & Rights',
  'Education & Culture',
  'Foreign Affairs',
  'Constitutional Affairs',
  'Defense & Security',
  'Infrastructure',
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
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
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

// ─── Petition Card ────────────────────────────────────────────────────────────

function PetitionCard({ petition, onSign }: { petition: CivicPetitionEntry; onSign: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [signing, setSigning] = useState(false)
  const cfg = ACTION_CONFIG[petition.action_type] ?? ACTION_CONFIG.hearing
  const ActionIcon = cfg.icon
  const isOpen = petition.status === 'open'
  const isFulfilled = petition.status === 'fulfilled'

  async function handleSign() {
    if (signing) return
    setSigning(true)
    try {
      await onSign(petition.id)
    } finally {
      setSigning(false)
    }
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'rounded-2xl border p-5 transition-colors',
        isFulfilled
          ? 'bg-emerald/5 border-emerald/20'
          : 'bg-surface-100 border-surface-300 hover:border-surface-400'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl border',
            cfg.bg,
            cfg.border
          )}
          aria-hidden="true"
        >
          <ActionIcon className={cn('h-4 w-4', cfg.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-sm font-mono font-semibold text-white leading-snug">{petition.title}</h2>
            {isFulfilled && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald/20 text-emerald border border-emerald/40">
                <Check className="h-2.5 w-2.5" aria-hidden="true" />
                Fulfilled
              </span>
            )}
            {petition.status === 'expired' && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-surface-300/60 text-surface-500 border border-surface-400/60">
                Expired
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border',
                cfg.bg,
                cfg.border,
                cfg.color
              )}
            >
              <ActionIcon className="h-2.5 w-2.5" aria-hidden="true" />
              {cfg.label}
            </span>
            <span className="text-[10px] font-mono text-surface-500">
              {petition.committee}
            </span>
          </div>
        </div>
      </div>

      {/* Topic link */}
      {petition.topic && (
        <Link
          href={`/topic/${petition.topic.id}`}
          className="block mb-3 px-3 py-2 rounded-lg bg-surface-200/50 border border-surface-300 hover:border-surface-400 transition-colors"
        >
          <p className="text-[11px] font-mono text-surface-500 mb-0.5">Related topic</p>
          <p className="text-xs font-mono text-surface-700 line-clamp-1">{petition.topic.statement}</p>
        </Link>
      )}

      {/* Description (collapsible) */}
      <div className="mb-4">
        <p
          className={cn(
            'text-xs font-mono text-surface-500 leading-relaxed',
            !expanded && 'line-clamp-2'
          )}
        >
          {petition.description}
        </p>
        {petition.description.length > 120 && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="mt-1 inline-flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-surface-300 transition-colors"
            aria-expanded={expanded}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" aria-hidden="true" /> Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" aria-hidden="true" /> Read more
              </>
            )}
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5 text-[10px] font-mono">
          <span className="text-surface-500">
            <span className="text-white font-semibold">
              {petition.signature_count.toLocaleString()}
            </span>{' '}
            / {petition.target_signatures.toLocaleString()} signatures
          </span>
          <span className={cn(
            'font-semibold',
            petition.pct_complete >= 100 ? 'text-emerald' :
            petition.pct_complete >= 75 ? 'text-gold' :
            'text-surface-500'
          )}>
            {petition.pct_complete}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={petition.pct_complete}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${petition.pct_complete}% of signatures collected`}
          className="w-full h-2 bg-surface-300 rounded-full overflow-hidden"
        >
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              petition.pct_complete >= 100 ? 'bg-emerald' :
              petition.pct_complete >= 75 ? 'bg-gold' :
              'bg-for-500'
            )}
            style={{ width: `${Math.min(100, petition.pct_complete)}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {petition.creator && (
            <Link
              href={`/profile/${petition.creator.username}`}
              className="flex items-center gap-1.5 text-[10px] font-mono text-surface-500 hover:text-surface-300 transition-colors"
            >
              <Avatar
                src={petition.creator.avatar_url}
                fallback={petition.creator.display_name ?? petition.creator.username}
                size="xs"
              />
              {petition.creator.display_name ?? petition.creator.username}
            </Link>
          )}
          {isOpen && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
              <Clock className="h-2.5 w-2.5" aria-hidden="true" />
              {timeLeft(petition.closes_at)}
            </span>
          )}
          {!isOpen && (
            <span className="text-[10px] font-mono text-surface-600">
              {relativeTime(petition.created_at)}
            </span>
          )}
        </div>

        {isOpen && (
          <button
            type="button"
            onClick={handleSign}
            disabled={signing}
            aria-label={petition.user_has_signed ? 'Remove your signature' : 'Sign this petition'}
            aria-pressed={petition.user_has_signed}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              petition.user_has_signed
                ? 'bg-emerald/20 border-emerald/40 text-emerald hover:bg-emerald/30'
                : 'bg-for-600/80 border-for-600/50 text-white hover:bg-for-600'
            )}
          >
            {signing ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : petition.user_has_signed ? (
              <Check className="h-3 w-3" aria-hidden="true" />
            ) : (
              <ScrollText className="h-3 w-3" aria-hidden="true" />
            )}
            {petition.user_has_signed ? 'Signed' : 'Sign'}
          </button>
        )}
      </div>
    </motion.article>
  )
}

// ─── Create Form ──────────────────────────────────────────────────────────────

interface CreateFormData {
  title: string
  description: string
  committee: string
  action_type: ActionType
  target_signatures: number
  closes_in_days: number
  topic_id: string
}

const EMPTY_FORM: CreateFormData = {
  title: '',
  description: '',
  committee: COMMITTEES[0],
  action_type: 'hearing',
  target_signatures: 100,
  closes_in_days: 30,
  topic_id: '',
}

function CreateForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState<CreateFormData>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof CreateFormData>(key: K, value: CreateFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/civic-petitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json()
        const msgs: Record<string, string> = {
          not_authenticated: 'Please sign in to create a petition.',
          title_length: 'Title must be 10–200 characters.',
          description_length: 'Description must be 20–2000 characters.',
          committee_required: 'Please select a committee.',
          invalid_action_type: 'Invalid action type.',
        }
        setError(msgs[d.error] ?? 'Failed to create petition. Please try again.')
        return
      }
      setForm(EMPTY_FORM)
      onCreated()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 p-3 rounded-xl bg-against-500/10 border border-against-500/30"
        >
          <AlertTriangle className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs font-mono text-against-300">{error}</p>
        </div>
      )}

      {/* Title */}
      <div>
        <label
          htmlFor="petition-title"
          className="block text-xs font-mono font-semibold text-surface-500 mb-1.5"
        >
          Petition title <span className="text-against-400" aria-label="required">*</span>
        </label>
        <input
          id="petition-title"
          type="text"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="We the citizens demand…"
          maxLength={200}
          required
          className="w-full bg-surface-200 border border-surface-300 rounded-xl px-4 py-2.5 text-sm font-mono text-white placeholder-surface-500 focus:outline-none focus:border-for-500 transition-colors"
        />
        <p className="text-[10px] font-mono text-surface-600 mt-1">
          {form.title.length}/200 characters
        </p>
      </div>

      {/* Action type + Committee */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="petition-action"
            className="block text-xs font-mono font-semibold text-surface-500 mb-1.5"
          >
            Action demanded <span className="text-against-400" aria-label="required">*</span>
          </label>
          <select
            id="petition-action"
            value={form.action_type}
            onChange={(e) => set('action_type', e.target.value as ActionType)}
            required
            className="w-full bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-for-500 transition-colors"
          >
            {(Object.keys(ACTION_CONFIG) as ActionType[]).map((at) => (
              <option key={at} value={at}>
                {ACTION_CONFIG[at].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="petition-committee"
            className="block text-xs font-mono font-semibold text-surface-500 mb-1.5"
          >
            Committee <span className="text-against-400" aria-label="required">*</span>
          </label>
          <select
            id="petition-committee"
            value={form.committee}
            onChange={(e) => set('committee', e.target.value)}
            required
            className="w-full bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-for-500 transition-colors"
          >
            {COMMITTEES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Action type description */}
      <p className="text-[10px] font-mono text-surface-500 -mt-2 ml-0.5" aria-live="polite">
        {ACTION_CONFIG[form.action_type].description}
      </p>

      {/* Description */}
      <div>
        <label
          htmlFor="petition-description"
          className="block text-xs font-mono font-semibold text-surface-500 mb-1.5"
        >
          Case for action <span className="text-against-400" aria-label="required">*</span>
        </label>
        <textarea
          id="petition-description"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="State clearly why this action is necessary, what evidence supports it, and what outcome you're demanding…"
          rows={4}
          maxLength={2000}
          required
          className="w-full bg-surface-200 border border-surface-300 rounded-xl px-4 py-2.5 text-sm font-mono text-white placeholder-surface-500 focus:outline-none focus:border-for-500 transition-colors resize-none"
        />
        <p className="text-[10px] font-mono text-surface-600 mt-1">
          {form.description.length}/2000 characters
        </p>
      </div>

      {/* Targets */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="petition-signatures"
            className="block text-xs font-mono font-semibold text-surface-500 mb-1.5"
          >
            Signature target
          </label>
          <select
            id="petition-signatures"
            value={form.target_signatures}
            onChange={(e) => set('target_signatures', Number(e.target.value))}
            className="w-full bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-for-500 transition-colors"
          >
            {[25, 50, 100, 250, 500, 1000, 2500, 5000].map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString()} signatures
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="petition-deadline"
            className="block text-xs font-mono font-semibold text-surface-500 mb-1.5"
          >
            Deadline
          </label>
          <select
            id="petition-deadline"
            value={form.closes_in_days}
            onChange={(e) => set('closes_in_days', Number(e.target.value))}
            className="w-full bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-for-500 transition-colors"
          >
            {[7, 14, 30, 60, 90].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || form.title.trim().length < 10 || form.description.trim().length < 20}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-3 rounded-xl font-mono font-semibold text-sm transition-all',
          'bg-for-600 hover:bg-for-500 text-white',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Filing petition…
          </>
        ) : (
          <>
            <ScrollText className="h-4 w-4" aria-hidden="true" />
            File petition
          </>
        )}
      </button>
    </form>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function CivicPetitionsClient() {
  const [petitions, setPetitions] = useState<CivicPetitionEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('open')
  const [createOpen, setCreateOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const fetchPetitions = useCallback(async (tab: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/civic-petitions?status=${tab}&limit=30`)
      if (!res.ok) return
      const data = (await res.json()) as CivicPetitionsResponse
      setPetitions(data.petitions)
      setTotal(data.total)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPetitions(activeTab)
  }, [fetchPetitions, activeTab, refreshKey])

  async function handleSign(id: string) {
    const res = await fetch(`/api/civic-petitions/${id}/sign`, { method: 'POST' })
    if (!res.ok) return
    const { signed, signature_count } = (await res.json()) as {
      signed: boolean
      signature_count: number
    }
    setPetitions((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              user_has_signed: signed,
              signature_count,
              pct_complete: p.target_signatures > 0
                ? Math.min(100, Math.round((signature_count / p.target_signatures) * 100))
                : 0,
              status: signature_count >= p.target_signatures ? 'fulfilled' : p.status,
            }
          : p
      )
    )
  }

  function handleCreated() {
    setCreateOpen(false)
    setActiveTab('open')
    setRefreshKey((k) => k + 1)
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0"
              aria-hidden="true"
            >
              <ScrollText className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Petitions</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {total > 0 ? `${total} petition${total === 1 ? '' : 's'}` : 'Citizen-initiated democratic action'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen((o) => !o)}
            aria-expanded={createOpen}
            aria-controls="create-form-region"
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-semibold border transition-all flex-shrink-0',
              createOpen
                ? 'bg-surface-300 border-surface-400 text-white'
                : 'bg-for-600/80 border-for-600/50 text-white hover:bg-for-600'
            )}
          >
            {createOpen ? (
              <>
                <X className="h-3.5 w-3.5" aria-hidden="true" /> Cancel
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" /> File petition
              </>
            )}
          </button>
        </div>

        {/* Info banner */}
        <div className="mb-6 p-4 rounded-2xl bg-surface-200/50 border border-surface-300">
          <p className="text-xs font-mono text-surface-500 leading-relaxed">
            Civic petitions are formal demands for democratic action.  When a petition reaches
            its signature target, the relevant committee is obligated to respond — scheduling a
            hearing, triggering a referendum, or convening a Citizens Assembly.
          </p>
        </div>

        {/* Create form */}
        <AnimatePresence>
          {createOpen && (
            <motion.section
              id="create-form-region"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              aria-label="Create a new petition"
              className="overflow-hidden mb-6"
            >
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <h2 className="font-mono text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-for-400" aria-hidden="true" />
                  New petition
                </h2>
                <CreateForm onCreated={handleCreated} />
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Filter petitions by status"
          className="flex items-center gap-2 mb-6 flex-wrap"
        >
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls="petitions-list"
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-1.5 rounded-full text-xs font-mono font-semibold border transition-all',
                activeTab === tab.id
                  ? 'bg-for-600/80 border-for-600/50 text-white'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
              )}
            >
              {tab.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            aria-label="Refresh petition list"
            className="ml-auto p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Action type legend */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          {(Object.keys(ACTION_CONFIG) as ActionType[]).map((at) => {
            const c = ACTION_CONFIG[at]
            const Icon = c.icon
            return (
              <span
                key={at}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border',
                  c.bg,
                  c.border,
                  c.color
                )}
              >
                <Icon className="h-2.5 w-2.5" aria-hidden="true" />
                {c.label}
              </span>
            )
          })}
        </div>

        {/* List */}
        <section
          id="petitions-list"
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
        >
          {loading ? (
            <div className="space-y-4" aria-busy="true" aria-label="Loading petitions">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-2 w-full rounded-full mt-3" />
                  <div className="flex gap-2 pt-1">
                    <Skeleton className="h-7 w-16 rounded-lg" />
                    <Skeleton className="h-7 w-24 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : petitions.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              iconColor="text-for-400"
              iconBg="bg-for-500/10"
              iconBorder="border-for-500/30"
              title={activeTab === 'open' ? 'No open petitions' : 'Nothing here'}
              description={
                activeTab === 'open'
                  ? 'No petitions are currently open. File one to demand civic action on a topic that matters to you.'
                  : 'No petitions match this filter.'
              }
              actions={
                activeTab === 'open'
                  ? [
                      {
                        label: 'File a petition',
                        onClick: () => setCreateOpen(true),
                        icon: Plus,
                      },
                    ]
                  : undefined
              }
            />
          ) : (
            <div className="space-y-4">
              {petitions.map((petition) => (
                <PetitionCard key={petition.id} petition={petition} onSign={handleSign} />
              ))}
            </div>
          )}
        </section>

        {/* Footer links */}
        <div className="mt-10 pt-6 border-t border-surface-300 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-xs font-mono text-surface-600">
            Petitions that reach their target are escalated to the relevant committee automatically.
          </p>
          <div className="flex items-center gap-3">
            <Link
              href="/civic-hearings"
              className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <Gavel className="h-3 w-3" aria-hidden="true" />
              Hearings
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
            <Link
              href="/civic-referendums"
              className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <Vote className="h-3 w-3" aria-hidden="true" />
              Referendums
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
