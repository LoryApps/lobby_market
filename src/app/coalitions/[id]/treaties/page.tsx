'use client'

/**
 * /coalitions/[id]/treaties — Coalition Diplomatic Relations
 *
 * Leaders and officers manage formal treaties with other coalitions.
 * Three treaty types:
 *   Alliance          — mutual vote coordination on shared-stance topics
 *   Non-Aggression    — agree not to challenge each other in coalition_challenges
 *   Research Exchange — share sources and evidence across coalition members
 *
 * Tabs:
 *   Active   — currently in-force treaties (with expiry countdown)
 *   Pending  — proposals awaiting acceptance (incoming & outgoing)
 *   History  — expired, broken, or rejected treaties
 *
 * Leaders/officers can propose new treaties via the "New Treaty" modal.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  FileText,
  Handshake,
  Loader2,
  Plus,
  Search,
  Shield,
  Users,
  X,
  BookOpen,
  AlertTriangle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CoalitionTreaty, CoalitionTreatiesResponse } from '@/app/api/coalitions/[id]/treaties/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'active' | 'pending' | 'history'
type TreatyType = 'alliance' | 'non_aggression' | 'research_exchange'
type TreatyStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'broken'

interface CoalitionSearchResult {
  id: string
  name: string
  member_count: number
  coalition_influence: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeUntilExpiry(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor((diff % 86_400_000) / 3_600_000)
  if (d >= 2) return `${d} days left`
  if (d === 1) return `1 day left`
  if (h >= 1) return `${h}h left`
  return 'Expiring soon'
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Treaty type config ───────────────────────────────────────────────────────

const TREATY_TYPE_CONFIG: Record<TreatyType, { label: string; icon: typeof Handshake; color: string; bg: string; description: string }> = {
  alliance: {
    label: 'Alliance',
    icon: Handshake,
    color: 'text-for-400',
    bg: 'bg-for-500/10 border-for-500/30',
    description: 'Mutual vote coordination on shared-stance topics',
  },
  non_aggression: {
    label: 'Non-Aggression Pact',
    icon: Shield,
    color: 'text-gold',
    bg: 'bg-gold/10 border-gold/30',
    description: 'Agree not to file challenges against each other',
  },
  research_exchange: {
    label: 'Research Exchange',
    icon: BookOpen,
    color: 'text-purple',
    bg: 'bg-purple/10 border-purple/30',
    description: 'Share sources and evidence across coalition members',
  },
}

const STATUS_CONFIG: Record<TreatyStatus, { label: string; color: string }> = {
  pending:  { label: 'Pending',  color: 'text-gold' },
  accepted: { label: 'Active',   color: 'text-for-400' },
  rejected: { label: 'Rejected', color: 'text-against-400' },
  expired:  { label: 'Expired',  color: 'text-surface-500' },
  broken:   { label: 'Broken',   color: 'text-against-300' },
}

// ─── Treaty card ──────────────────────────────────────────────────────────────

function TreatyCard({
  treaty,
  coalitionId,
  isLeader,
  onAccept,
  onReject,
  onBreak,
}: {
  treaty: CoalitionTreaty
  coalitionId: string
  isLeader: boolean
  onAccept: (id: string) => void
  onReject: (id: string) => void
  onBreak: (id: string) => void
}) {
  const cfg = TREATY_TYPE_CONFIG[treaty.treaty_type]
  const statusCfg = STATUS_CONFIG[treaty.status]
  const Icon = cfg.icon
  const [acting, setActing] = useState<string | null>(null)

  async function handle(action: 'accept' | 'reject' | 'break') {
    setActing(action)
    try {
      const res = await fetch(`/api/coalitions/${coalitionId}/treaties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, treaty_id: treaty.id }),
      })
      if (res.ok) {
        if (action === 'accept') onAccept(treaty.id)
        else if (action === 'reject') onReject(treaty.id)
        else onBreak(treaty.id)
      }
    } finally {
      setActing(null)
    }
  }

  const canRespond = !treaty.is_proposer && treaty.status === 'pending' && isLeader
  const canBreak = treaty.status === 'accepted' && isLeader

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-surface-100 border rounded-2xl p-4 space-y-3',
        treaty.status === 'accepted'
          ? 'border-for-500/20'
          : treaty.status === 'pending'
          ? 'border-gold/20'
          : 'border-surface-300'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn('p-2 rounded-xl border', cfg.bg)}>
          <Icon className={cn('h-4 w-4', cfg.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-surface-900 text-sm leading-tight">
              {treaty.title}
            </span>
            <span className={cn('text-xs font-mono font-bold uppercase', statusCfg.color)}>
              {statusCfg.label}
            </span>
          </div>
          <p className="text-xs text-surface-500 mt-0.5">{cfg.label}</p>
        </div>
      </div>

      {/* Partner */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-surface-500">
          {treaty.is_proposer ? 'Proposed to:' : 'Proposed by:'}
        </span>
        <Link
          href={`/coalitions/${treaty.partner.id}`}
          className="flex items-center gap-1.5 text-xs font-semibold text-surface-800 hover:text-for-400 transition-colors"
        >
          <Users className="h-3 w-3" />
          {treaty.partner.name}
          <span className="font-mono text-surface-500">
            ({treaty.partner.member_count} members)
          </span>
        </Link>
      </div>

      {/* Terms */}
      {treaty.terms && (
        <p className="text-xs text-surface-600 bg-surface-200/60 rounded-lg px-3 py-2 leading-relaxed">
          {treaty.terms}
        </p>
      )}

      {/* Meta row */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-surface-500 font-mono">
        <div className="flex items-center gap-3">
          <span>{relativeTime(treaty.proposed_at)}</span>
          {treaty.duration_days && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {treaty.duration_days}d term
            </span>
          )}
        </div>
        {treaty.expires_at && treaty.status === 'accepted' && (
          <span className="text-for-400 font-semibold">
            {timeUntilExpiry(treaty.expires_at)}
          </span>
        )}
        {treaty.is_proposer && treaty.status === 'pending' && (
          <span className="text-gold">Awaiting response</span>
        )}
      </div>

      {/* Actions */}
      {(canRespond || canBreak) && (
        <div className="flex gap-2 pt-1 border-t border-surface-300">
          {canRespond && (
            <>
              <button
                onClick={() => handle('accept')}
                disabled={acting !== null}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-for-600/20 hover:bg-for-600/30 text-for-400 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {acting === 'accept' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Accept
              </button>
              <button
                onClick={() => handle('reject')}
                disabled={acting !== null}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-against-600/20 hover:bg-against-600/30 text-against-400 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {acting === 'reject' ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                Reject
              </button>
            </>
          )}
          {canBreak && (
            <button
              onClick={() => handle('break')}
              disabled={acting !== null}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-against-600/10 hover:bg-against-600/20 text-against-400 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {acting === 'break' ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
              Break Treaty
            </button>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ─── New treaty modal ─────────────────────────────────────────────────────────

function NewTreatyModal({
  coalitionId,
  onClose,
  onCreated,
}: {
  coalitionId: string
  onClose: () => void
  onCreated: () => void
}) {
  const [step, setStep] = useState<'search' | 'configure'>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CoalitionSearchResult[]>([])
  const [selected, setSelected] = useState<CoalitionSearchResult | null>(null)
  const [treatyType, setTreatyType] = useState<TreatyType>('alliance')
  const [title, setTitle] = useState('')
  const [terms, setTerms] = useState('')
  const [durationDays, setDurationDays] = useState(14)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function searchCoalitions(q: string) {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/coalitions?search=${encodeURIComponent(q)}&limit=8`)
      if (res.ok) {
        const data = await res.json() as { coalitions: CoalitionSearchResult[] }
        setResults((data.coalitions ?? []).filter((c) => c.id !== coalitionId))
      }
    } finally {
      setLoading(false)
    }
  }

  function handleQueryChange(val: string) {
    setQuery(val)
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => searchCoalitions(val), 350)
  }

  async function handleSubmit() {
    if (!selected || !title.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/coalitions/${coalitionId}/treaties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'propose',
          recipient_id: selected.id,
          treaty_type: treatyType,
          title: title.trim(),
          terms: terms.trim() || undefined,
          duration_days: durationDays,
        }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Failed to propose treaty')
        return
      }
      onCreated()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="relative bg-surface-100 border border-surface-300 rounded-2xl w-full max-w-lg p-5 space-y-4 max-h-[90dvh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-surface-900 text-base">Propose a Treaty</h2>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-300 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === 'search' ? (
          <>
            <p className="text-xs text-surface-500">Search for a coalition to propose a diplomatic agreement with.</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search coalitions…"
                className="w-full bg-surface-200 border border-surface-400 rounded-xl pl-9 pr-4 py-2.5 text-sm text-surface-900 placeholder-surface-600 focus:outline-none focus:border-for-500 transition-colors"
                autoFocus
              />
            </div>
            {loading && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-surface-500" />
              </div>
            )}
            {results.length > 0 && (
              <div className="space-y-1.5">
                {results.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setSelected(c); setStep('configure') }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-200 transition-colors text-left"
                  >
                    <div className="h-9 w-9 rounded-full bg-surface-300 flex items-center justify-center">
                      <Shield className="h-4 w-4 text-surface-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-surface-900 text-sm truncate">{c.name}</p>
                      <p className="text-xs text-surface-500 font-mono">
                        {c.member_count} members · {c.coalition_influence} influence
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-surface-500" />
                  </button>
                ))}
              </div>
            )}
            {!loading && query.length >= 2 && results.length === 0 && (
              <p className="text-center text-surface-500 text-sm py-4">No coalitions found</p>
            )}
          </>
        ) : (
          <>
            {/* Selected partner */}
            <div className="flex items-center gap-3 p-3 bg-surface-200/60 rounded-xl">
              <div className="h-9 w-9 rounded-full bg-surface-300 flex items-center justify-center">
                <Shield className="h-4 w-4 text-surface-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-surface-900 text-sm">{selected?.name}</p>
                <p className="text-xs text-surface-500 font-mono">{selected?.member_count} members</p>
              </div>
              <button onClick={() => { setSelected(null); setStep('search') }} className="text-surface-500 hover:text-surface-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Treaty type */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-surface-600 uppercase tracking-widest">Treaty Type</label>
              <div className="grid grid-cols-1 gap-2">
                {(Object.entries(TREATY_TYPE_CONFIG) as [TreatyType, typeof TREATY_TYPE_CONFIG[TreatyType]][]).map(([type, cfg]) => {
                  const Icon = cfg.icon
                  return (
                    <button
                      key={type}
                      onClick={() => setTreatyType(type)}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                        treatyType === type
                          ? cn('border-for-500/40 bg-for-500/10')
                          : 'border-surface-400 bg-surface-200/60 hover:bg-surface-200'
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', treatyType === type ? cfg.color : 'text-surface-500')} />
                      <div>
                        <p className={cn('text-sm font-semibold', treatyType === type ? 'text-surface-900' : 'text-surface-700')}>
                          {cfg.label}
                        </p>
                        <p className="text-xs text-surface-500">{cfg.description}</p>
                      </div>
                      {treatyType === type && <Check className="h-4 w-4 ml-auto text-for-400" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-surface-600 uppercase tracking-widest">Title *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                placeholder="e.g. The Progressive Alliance Accord"
                className="w-full bg-surface-200 border border-surface-400 rounded-xl px-4 py-2.5 text-sm text-surface-900 placeholder-surface-600 focus:outline-none focus:border-for-500 transition-colors"
              />
            </div>

            {/* Terms */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-surface-600 uppercase tracking-widest">Terms (optional)</label>
              <textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Describe the specific commitments or conditions of this treaty…"
                className="w-full bg-surface-200 border border-surface-400 rounded-xl px-4 py-2.5 text-sm text-surface-900 placeholder-surface-600 focus:outline-none focus:border-for-500 transition-colors resize-none"
              />
              <p className="text-right text-xs text-surface-600 font-mono">{terms.length}/500</p>
            </div>

            {/* Duration */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-surface-600 uppercase tracking-widest">Duration</label>
              <div className="flex gap-2">
                {[7, 14, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDurationDays(d)}
                    className={cn(
                      'flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors',
                      durationDays === d
                        ? 'bg-for-600/20 border-for-500/40 text-for-400'
                        : 'bg-surface-200 border-surface-400 text-surface-600 hover:bg-surface-300'
                    )}
                  >
                    {d} days
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-against-600/10 border border-against-500/30 rounded-xl text-against-400 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!title.trim() || submitting}
              className="w-full py-3 rounded-xl bg-for-600 hover:bg-for-500 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Handshake className="h-4 w-4" />}
              Propose Treaty
            </button>
          </>
        )}
      </motion.div>
    </div>
  )
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function TreatySkeleton() {
  return (
    <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 space-y-3 animate-pulse">
      <div className="flex gap-3">
        <div className="h-9 w-9 rounded-xl bg-surface-300" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 w-2/3 rounded bg-surface-300" />
          <div className="h-3 w-1/3 rounded bg-surface-300" />
        </div>
      </div>
      <div className="h-3 w-3/4 rounded bg-surface-300" />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CoalitionTreatiesPage() {
  const params = useParams()
  const coalitionId = params.id as string

  const [tab, setTab] = useState<Tab>('active')
  const [treaties, setTreaties] = useState<CoalitionTreaty[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [coalitionName, setCoalitionName] = useState<string>('')
  const [showModal, setShowModal] = useState(false)

  const isLeader = currentUserRole === 'leader' || currentUserRole === 'officer'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/coalitions/${coalitionId}/treaties`)
      if (res.ok) {
        const data = await res.json() as CoalitionTreatiesResponse
        setTreaties(data.treaties ?? [])
        setCurrentUserRole(data.currentUserRole)
        setCoalitionName(data.coalition?.name ?? '')
      }
    } finally {
      setLoading(false)
    }
  }, [coalitionId])

  useEffect(() => { load() }, [load])

  const activeTreaties = treaties.filter(
    (t) => t.status === 'accepted' && t.expires_at && t.expires_at > new Date().toISOString()
  )
  const pendingTreaties = treaties.filter((t) => t.status === 'pending')
  const historyTreaties = treaties.filter(
    (t) =>
      t.status === 'rejected' ||
      t.status === 'expired' ||
      t.status === 'broken' ||
      (t.status === 'accepted' && (!t.expires_at || t.expires_at <= new Date().toISOString()))
  )

  const displayed =
    tab === 'active' ? activeTreaties : tab === 'pending' ? pendingTreaties : historyTreaties

  function handleAccept(id: string) {
    setTreaties((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: 'accepted', accepted_at: new Date().toISOString(), expires_at: null }
          : t
      )
    )
    load()
  }

  function handleReject(id: string) {
    setTreaties((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'rejected' } : t)))
  }

  function handleBreak(id: string) {
    setTreaties((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'broken' } : t)))
  }

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'active', label: 'Active', count: activeTreaties.length },
    { id: 'pending', label: 'Pending', count: pendingTreaties.length },
    { id: 'history', label: 'History', count: historyTreaties.length },
  ]

  return (
    <div className="min-h-screen bg-surface-50 pb-20">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href={`/coalitions/${coalitionId}`} className="text-surface-500 hover:text-surface-300 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-surface-900 flex items-center gap-2">
              <Handshake className="h-5 w-5 text-for-400" />
              Coalition Treaties
            </h1>
            {coalitionName && (
              <p className="text-xs text-surface-500 mt-0.5">
                <Link href={`/coalitions/${coalitionId}`} className="hover:text-surface-300 transition-colors">
                  {coalitionName}
                </Link>
                {' '}· Diplomatic Relations
              </p>
            )}
          </div>
          {isLeader && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-for-600/20 hover:bg-for-600/30 text-for-400 rounded-xl text-xs font-semibold transition-colors border border-for-500/30"
            >
              <Plus className="h-3.5 w-3.5" />
              Propose
            </button>
          )}
        </div>

        {/* Info banner */}
        <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4">
          <p className="text-xs text-surface-500 leading-relaxed">
            Treaties are formal diplomatic agreements between coalitions. An active treaty is publicly displayed
            on both coalition profiles. Leaders and officers can propose, accept, or break treaties.
          </p>
          <div className="flex flex-wrap gap-3 mt-3">
            {(Object.entries(TREATY_TYPE_CONFIG) as [TreatyType, typeof TREATY_TYPE_CONFIG[TreatyType]][]).map(([type, cfg]) => {
              const Icon = cfg.icon
              return (
                <div key={type} className="flex items-center gap-1.5 text-xs text-surface-500">
                  <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
                  <span className="font-semibold">{cfg.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-surface-200/50 rounded-xl p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5',
                tab === t.id
                  ? 'bg-surface-100 text-surface-900 shadow-sm'
                  : 'text-surface-500 hover:text-surface-300'
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span className={cn(
                  'px-1.5 py-0.5 rounded-full font-mono text-[10px]',
                  tab === t.id ? 'bg-for-500/20 text-for-400' : 'bg-surface-300 text-surface-500'
                )}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <TreatySkeleton key={i} />)}
          </div>
        ) : displayed.length === 0 ? (
          <EmptyState
            icon={tab === 'active' ? Handshake : tab === 'pending' ? Clock : FileText}
            title={
              tab === 'active'
                ? 'No active treaties'
                : tab === 'pending'
                ? 'No pending proposals'
                : 'No treaty history'
            }
            description={
              tab === 'active'
                ? isLeader
                  ? 'Propose a treaty with another coalition to build diplomatic ties.'
                  : 'This coalition has no active diplomatic agreements.'
                : tab === 'pending'
                ? 'No treaties are waiting for a response.'
                : 'Past treaties will appear here once resolved.'
            }
            action={
              tab === 'active' && isLeader
                ? { label: 'Propose a Treaty', onClick: () => setShowModal(true) }
                : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {displayed.map((treaty) => (
                <TreatyCard
                  key={treaty.id}
                  treaty={treaty}
                  coalitionId={coalitionId}
                  isLeader={isLeader}
                  onAccept={handleAccept}
                  onReject={handleReject}
                  onBreak={handleBreak}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Link to global treaties */}
        <div className="flex justify-center pt-2">
          <Link
            href="/coalitions/treaties"
            className="text-xs text-surface-500 hover:text-for-400 transition-colors flex items-center gap-1"
          >
            View all platform treaties
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </main>

      <BottomNav />

      <AnimatePresence>
        {showModal && (
          <NewTreatyModal
            coalitionId={coalitionId}
            onClose={() => setShowModal(false)}
            onCreated={load}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
