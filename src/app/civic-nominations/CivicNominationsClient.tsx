'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Crown,
  Gavel,
  Loader2,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Shield,
  Star,
  ThumbsUp,
  Users,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import type {
  NominationEntry,
  CivicNominationsResponse,
  CivicRole,
} from '@/app/api/civic-nominations/route'

// ─── Role Config ──────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<
  CivicRole,
  {
    label: string
    shortLabel: string
    icon: typeof Crown
    color: string
    bg: string
    border: string
    description: string
    responsibilities: string[]
    target: number
  }
> = {
  grand_council: {
    label: 'Grand Council Member',
    shortLabel: 'Council',
    icon: Crown,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    description:
      'Voting members of the Grand Council — the top-20 citizens who propose and vote on platform-wide civic motions and decrees.',
    responsibilities: [
      'Propose and second civic motions',
      'Vote on resolutions and proclamations',
      'Set platform-wide civic agenda',
    ],
    target: 15,
  },
  tribunal_judge: {
    label: 'Tribunal Judge',
    shortLabel: 'Tribunal',
    icon: Gavel,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    description:
      'Civic Tribunal judges review challenged arguments and deliver peer verdicts on quality and accuracy.',
    responsibilities: [
      'Review and adjudicate argument challenges',
      'Deliver impartial verdicts',
      'Uphold community discourse standards',
    ],
    target: 10,
  },
  fact_checker: {
    label: 'Platform Fact Checker',
    shortLabel: 'Fact Checker',
    icon: Shield,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    description:
      'Verified fact-checkers can flag misleading claims in arguments and attach evidence assessments.',
    responsibilities: [
      'Flag factually contested arguments',
      'Attach sourced evidence assessments',
      'Request tribunal review for severe violations',
    ],
    target: 8,
  },
  debate_moderator: {
    label: 'Debate Moderator',
    shortLabel: 'Moderator',
    icon: Scale,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    description:
      'Licensed moderators can facilitate structured debates, enforce time rules, and award debate verdicts.',
    responsibilities: [
      'Facilitate live structured debates',
      'Enforce debate rules and time limits',
      'Award and record debate outcomes',
    ],
    target: 10,
  },
  assembly_rapporteur: {
    label: 'Assembly Rapporteur',
    shortLabel: 'Rapporteur',
    icon: Users,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    description:
      'Rapporteurs facilitate Citizens\' Assembly sessions — guiding deliberation, synthesising positions, and publishing assembly reports.',
    responsibilities: [
      'Facilitate Citizens Assembly sessions',
      'Synthesise and report assembly findings',
      'Coordinate cross-partisan deliberation',
    ],
    target: 8,
  },
}

const STATUS_TABS = [
  { id: 'open', label: 'Open' },
  { id: 'elected', label: 'Elected' },
  { id: 'expired', label: 'Expired' },
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
  if (diff <= 0) return 'Closed'
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor((diff % 86_400_000) / 3_600_000)
  if (d > 1) return `${d} days left`
  if (d === 1) return '1 day left'
  if (h > 0) return `${h}h left`
  return 'Closes soon'
}

// ─── Nomination Card ──────────────────────────────────────────────────────────

function NominationCard({
  nomination,
  onEndorse,
}: {
  nomination: NominationEntry
  onEndorse: (id: string, endorsed: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [endorsing, setEndorsing] = useState(false)
  const cfg = ROLE_CONFIG[nomination.role]
  const RoleIcon = cfg.icon
  const isOpen = nomination.status === 'open'
  const isElected = nomination.status === 'elected'

  async function handleEndorse() {
    if (endorsing || !isOpen) return
    setEndorsing(true)
    try {
      await onEndorse(nomination.id, nomination.user_has_endorsed)
    } finally {
      setEndorsing(false)
    }
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'rounded-2xl border p-5 transition-colors',
        isElected
          ? 'bg-gold/5 border-gold/20'
          : 'bg-surface-100 border-surface-300 hover:border-surface-400'
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl border',
            cfg.bg,
            cfg.border
          )}
          aria-hidden="true"
        >
          <RoleIcon className={cn('h-4 w-4', cfg.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border',
                cfg.bg, cfg.border, cfg.color
              )}
            >
              <RoleIcon className="h-2.5 w-2.5" aria-hidden="true" />
              {cfg.shortLabel}
            </span>

            {isElected && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-gold/20 text-gold border border-gold/40">
                <Check className="h-2.5 w-2.5" aria-hidden="true" />
                Elected
              </span>
            )}
            {nomination.status === 'expired' && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-surface-300/60 text-surface-500 border border-surface-400/60">
                Expired
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Nominee */}
      {nomination.nominee && (
        <Link
          href={`/profile/${nomination.nominee.username}`}
          className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-surface-200/50 border border-surface-300 hover:border-surface-400 transition-colors"
        >
          <Avatar
            src={nomination.nominee.avatar_url}
            username={nomination.nominee.username}
            size={40}
            className="flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-mono font-semibold text-white truncate">
              {nomination.nominee.display_name || nomination.nominee.username}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[10px] font-mono text-surface-500">
                @{nomination.nominee.username}
              </span>
              <span className="text-[10px] font-mono text-gold">
                {nomination.nominee.clout.toLocaleString()} clout
              </span>
              <span className="text-[10px] font-mono text-surface-500">
                {nomination.nominee.total_votes.toLocaleString()} votes
              </span>
            </div>
          </div>
          <Star className="h-4 w-4 text-surface-500 flex-shrink-0" aria-hidden="true" />
        </Link>
      )}

      {/* Reason */}
      <div className="mb-4">
        <p
          className={cn(
            'text-xs font-mono text-surface-500 leading-relaxed',
            !expanded && 'line-clamp-2'
          )}
        >
          {nomination.reason}
        </p>
        {nomination.reason.length > 100 && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="mt-1 inline-flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-surface-300 transition-colors"
            aria-expanded={expanded}
          >
            {expanded ? (
              <><ChevronUp className="h-3 w-3" aria-hidden="true" />Show less</>
            ) : (
              <><ChevronDown className="h-3 w-3" aria-hidden="true" />Read more</>
            )}
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-mono text-surface-500">
            {nomination.endorsement_count} / {nomination.endorsement_target} endorsements
          </span>
          <span className="text-[10px] font-mono text-surface-500">
            {nomination.pct_complete}%
          </span>
        </div>
        <div className="relative h-1.5 bg-surface-300 rounded-full overflow-hidden">
          <motion.div
            className={cn(
              'absolute inset-y-0 left-0 rounded-full',
              isElected ? 'bg-gold' : cfg.color.replace('text-', 'bg-')
            )}
            initial={{ width: 0 }}
            animate={{ width: `${nomination.pct_complete}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-[10px] font-mono text-surface-500">
          {nomination.nominator && (
            <span>
              by{' '}
              <Link
                href={`/profile/${nomination.nominator.username}`}
                className="text-surface-400 hover:text-white transition-colors"
              >
                @{nomination.nominator.username}
              </Link>
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" aria-hidden="true" />
            {isOpen ? timeLeft(nomination.closes_at) : relativeTime(nomination.created_at)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/civic-nominations/${nomination.id}`}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-mono text-surface-500 hover:text-surface-300 hover:bg-surface-300 border border-surface-300 hover:border-surface-400 transition-all"
          >
            View
          </Link>

          {isOpen && (
            <button
              type="button"
              onClick={handleEndorse}
              disabled={endorsing}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
                'border transition-all',
                nomination.user_has_endorsed
                  ? 'bg-for-500/20 border-for-500/40 text-for-400 hover:bg-against-500/10 hover:border-against-500/30 hover:text-against-400'
                  : 'bg-surface-200 border-surface-400 text-surface-300 hover:bg-for-500/10 hover:border-for-500/30 hover:text-for-400',
                endorsing && 'opacity-50 cursor-not-allowed'
              )}
              aria-label={nomination.user_has_endorsed ? 'Remove endorsement' : 'Endorse this nomination'}
            >
              {endorsing ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : nomination.user_has_endorsed ? (
                <Check className="h-3 w-3" aria-hidden="true" />
              ) : (
                <ThumbsUp className="h-3 w-3" aria-hidden="true" />
              )}
              {nomination.user_has_endorsed ? 'Endorsed' : 'Endorse'}
            </button>
          )}
        </div>
      </div>
    </motion.article>
  )
}

// ─── Nominate Modal ───────────────────────────────────────────────────────────

function NominateModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [role, setRole] = useState<CivicRole>('grand_council')
  const [username, setUsername] = useState('')
  const [reason, setReason] = useState('')
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nominee, setNominee] = useState<{ id: string; username: string; display_name: string | null; avatar_url: string | null } | null>(null)

  async function searchUser() {
    if (!username.trim()) return
    setSearching(true)
    setError(null)
    setNominee(null)
    try {
      const params = new URLSearchParams({ q: username.trim(), tab: 'people' })
      const res = await fetch(`/api/search?${params.toString()}`)
      if (!res.ok) throw new Error('Search failed')
      const { results } = (await res.json()) as {
        results: Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null }>
      }
      if (results && results.length > 0) {
        setNominee(results[0])
      } else {
        setError('No citizen found with that username')
      }
    } catch {
      setError('Could not search for citizen')
    } finally {
      setSearching(false)
    }
  }

  async function handleSubmit() {
    if (!nominee || !reason.trim() || submitting) return
    if (reason.length < 20) {
      setError('Reason must be at least 20 characters')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/civic-nominations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, nominee_id: nominee.id, reason: reason.trim() }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Failed to submit nomination')
      }
      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit nomination')
    } finally {
      setSubmitting(false)
    }
  }

  const cfg = ROLE_CONFIG[role]
  const charCount = reason.length
  const charMax = 1000

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-lg bg-surface-100 rounded-2xl border border-surface-300 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-300">
          <div className="flex items-center gap-3">
            <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center border', cfg.bg, cfg.border)}>
              <Award className={cn('h-4 w-4', cfg.color)} />
            </div>
            <div>
              <h2 className="text-sm font-mono font-bold text-white">Submit Nomination</h2>
              <p className="text-[10px] font-mono text-surface-500">Nominate a citizen for a civic role</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Role selector */}
          <div>
            <label className="block text-[11px] font-mono font-semibold text-surface-400 uppercase tracking-wider mb-2">
              Role
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.entries(ROLE_CONFIG) as Array<[CivicRole, typeof ROLE_CONFIG[CivicRole]]>).map(([r, rcfg]) => {
                const Icon = rcfg.icon
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-3 rounded-xl border text-[10px] font-mono font-semibold transition-all',
                      role === r
                        ? cn(rcfg.bg, rcfg.border, rcfg.color)
                        : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-300'
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {rcfg.shortLabel}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-[10px] font-mono text-surface-500">{cfg.description}</p>
          </div>

          {/* Citizen search */}
          <div>
            <label htmlFor="nominee-search" className="block text-[11px] font-mono font-semibold text-surface-400 uppercase tracking-wider mb-2">
              Nominee
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="nominee-search"
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setNominee(null) }}
                  onKeyDown={(e) => e.key === 'Enter' && searchUser()}
                  placeholder="Search by username..."
                  className="w-full h-9 pl-3 pr-9 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-white placeholder-surface-500 focus:outline-none focus:border-surface-400"
                />
                {searching && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 animate-spin" aria-hidden="true" />
                )}
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={searchUser}
                disabled={searching || !username.trim()}
              >
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
            {nominee && (
              <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-for-500/10 border border-for-500/30">
                <Avatar src={nominee.avatar_url} username={nominee.username} size={28} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono font-semibold text-white">
                    {nominee.display_name || nominee.username}
                  </p>
                  <p className="text-[10px] font-mono text-surface-500">@{nominee.username}</p>
                </div>
                <Check className="h-3.5 w-3.5 text-for-400 flex-shrink-0" aria-hidden="true" />
              </div>
            )}
          </div>

          {/* Reason */}
          <div>
            <label htmlFor="nom-reason" className="block text-[11px] font-mono font-semibold text-surface-400 uppercase tracking-wider mb-2">
              Nomination Statement
            </label>
            <textarea
              id="nom-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, charMax))}
              placeholder={`Why should this citizen become a ${cfg.shortLabel}? Describe their qualifications, contributions, and character...`}
              rows={4}
              className="w-full p-3 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-white placeholder-surface-500 focus:outline-none focus:border-surface-400 resize-none"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] font-mono text-surface-500">Min. 20 characters</span>
              <span className={cn('text-[10px] font-mono', charCount > 900 ? 'text-against-400' : 'text-surface-500')}>
                {charCount}/{charMax}
              </span>
            </div>
          </div>

          {error && (
            <p className="text-[11px] font-mono text-against-400 px-3 py-2 rounded-lg bg-against-500/10 border border-against-500/30">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!nominee || reason.length < 20 || submitting}
              className="flex-1"
            >
              {submitting ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" aria-hidden="true" />Submitting…</>
              ) : (
                'Submit Nomination'
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CivicNominationsClient() {
  const [roleTab, setRoleTab] = useState<CivicRole | 'all'>('all')
  const [statusTab, setStatusTab] = useState<string>('open')
  const [nominations, setNominations] = useState<NominationEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  const fetchNominations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        role: roleTab,
        status: statusTab,
        limit: '30',
        offset: '0',
      })
      const res = await fetch(`/api/civic-nominations?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load nominations')
      const data = (await res.json()) as CivicNominationsResponse
      setNominations(data.nominations)
      setTotal(data.total)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [roleTab, statusTab])

  useEffect(() => { fetchNominations() }, [fetchNominations])

  async function handleEndorse(id: string, currentlyEndorsed: boolean) {
    try {
      const res = await fetch(`/api/civic-nominations/${id}/endorse`, {
        method: currentlyEndorsed ? 'DELETE' : 'POST',
      })
      if (!res.ok) {
        const j = await res.json()
        if (j.error === 'Authentication required') {
          window.location.href = '/login'
          return
        }
        throw new Error(j.error ?? 'Action failed')
      }
      // Optimistic update
      setNominations((prev) =>
        prev.map((n) => {
          if (n.id !== id) return n
          const newCount = currentlyEndorsed
            ? Math.max(0, n.endorsement_count - 1)
            : n.endorsement_count + 1
          return {
            ...n,
            endorsement_count: newCount,
            user_has_endorsed: !currentlyEndorsed,
            pct_complete: Math.min(100, Math.round((newCount / n.endorsement_target) * 100)),
          }
        })
      )
    } catch {
      // Silently fail — optimistic update is safe enough here
    }
  }

  const activeRoleCfg = roleTab !== 'all' ? ROLE_CONFIG[roleTab] : null

  return (
    <>
      <div className="min-h-screen bg-surface-0">
        <TopBar />

        <main className="max-w-2xl mx-auto px-4 pt-20 pb-24 md:pb-8">
          {/* Back nav */}
          <Link
            href="/civic-commons"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Civic Commons
          </Link>

          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-8 w-8 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center">
                  <Award className="h-4 w-4 text-gold" aria-hidden="true" />
                </div>
                <h1 className="text-xl font-mono font-bold text-white">Civic Nominations</h1>
              </div>
              <p className="text-xs font-mono text-surface-500 leading-relaxed">
                Nominate citizens for formal civic roles. Endorsements drive election — reach the
                threshold and earn your seat.
              </p>
            </div>
            <Button size="sm" onClick={() => setShowModal(true)} className="flex-shrink-0">
              <Plus className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
              Nominate
            </Button>
          </div>

          {/* Role stats row */}
          <div className="grid grid-cols-5 gap-1.5 mb-6">
            {(Object.entries(ROLE_CONFIG) as Array<[CivicRole, typeof ROLE_CONFIG[CivicRole]]>).map(([role, rcfg]) => {
              const Icon = rcfg.icon
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setRoleTab(roleTab === role ? 'all' : role)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-[9px] font-mono font-semibold transition-all',
                    roleTab === role
                      ? cn(rcfg.bg, rcfg.border, rcfg.color)
                      : 'bg-surface-100 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-300'
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:block text-center leading-tight">{rcfg.shortLabel}</span>
                </button>
              )
            })}
          </div>

          {/* Active role description */}
          <AnimatePresence>
            {activeRoleCfg && (
              <motion.div
                key={roleTab}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mb-4"
              >
                <div className={cn('p-3 rounded-xl border mb-4', activeRoleCfg.bg, activeRoleCfg.border)}>
                  <p className={cn('text-[11px] font-mono font-semibold mb-1', activeRoleCfg.color)}>
                    {activeRoleCfg.label}
                  </p>
                  <p className="text-[10px] font-mono text-surface-400 leading-relaxed mb-2">
                    {activeRoleCfg.description}
                  </p>
                  <ul className="space-y-0.5">
                    {activeRoleCfg.responsibilities.map((r) => (
                      <li key={r} className="flex items-center gap-1.5 text-[10px] font-mono text-surface-500">
                        <Check className={cn('h-2.5 w-2.5 flex-shrink-0', activeRoleCfg.color)} aria-hidden="true" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Status tabs */}
          <div className="flex gap-1.5 mb-5 overflow-x-auto pb-0.5 scrollbar-hide">
            {STATUS_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setStatusTab(t.id)}
                className={cn(
                  'flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-colors',
                  statusTab === t.id
                    ? 'bg-surface-300 text-white'
                    : 'text-surface-500 hover:text-surface-300'
                )}
              >
                {t.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] font-mono text-surface-500">{total} total</span>
              <button
                type="button"
                onClick={fetchNominations}
                className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
                aria-label="Refresh"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Nominations list */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-surface-300 p-5 space-y-3">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-8 w-full rounded" />
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <p className="text-xs font-mono text-against-400 mb-3">{error}</p>
              <Button size="sm" variant="secondary" onClick={fetchNominations}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : nominations.length === 0 ? (
            <EmptyState
              icon={Award}
              title={statusTab === 'open' ? 'No open nominations' : 'No nominations here'}
              description={
                statusTab === 'open'
                  ? 'Be the first to nominate a fellow citizen for a civic role.'
                  : 'No nominations match this filter.'
              }
              action={{
                label: 'Submit a Nomination',
                onClick: () => setShowModal(true),
              }}
            />
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {nominations.map((nom) => (
                  <NominationCard
                    key={nom.id}
                    nomination={nom}
                    onEndorse={handleEndorse}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </main>
      </div>
      <BottomNav />

      {/* Nominate modal */}
      <AnimatePresence>
        {showModal && (
          <NominateModal
            onClose={() => setShowModal(false)}
            onSuccess={() => {
              setShowModal(false)
              fetchNominations()
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
