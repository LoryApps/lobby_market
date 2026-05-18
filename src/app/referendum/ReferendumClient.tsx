'use client'

/**
 * /referendum — The Civic Referendum Chamber
 *
 * Platform-governance meta-voting. Citizens propose referendums on civic
 * questions, feature requests, community guidelines, and platform policy.
 * Votes accumulate over 7 days; reaching quorum + ≥55% FOR passes it.
 *
 * Distinct from:
 *   /polls       — quick 4-option community polls (arbitrary questions)
 *   /elections   — role elections for Elders/Senators
 *   /topic voting — formal FOR/AGAINST policy voting on topics
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Gavel,
  Globe,
  Info,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Vote,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  ReferendumCategory,
  ReferendumRow,
  ReferendumsResponse,
} from '@/app/api/referendums/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<
  ReferendumCategory,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string; border: string }
> = {
  governance: { label: 'Governance', icon: Landmark, color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30' },
  features:   { label: 'Features',   icon: Sparkles, color: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/30' },
  community:  { label: 'Community',  icon: Users, color: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/30' },
  policy:     { label: 'Policy',     icon: Scale, color: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
  other:      { label: 'Other',      icon: Globe, color: 'text-surface-500', bg: 'bg-surface-300/40', border: 'border-surface-400/30' },
}

const STATUS_TABS = [
  { key: 'open',   label: 'Open',       icon: Clock },
  { key: 'closed', label: 'Closed',     icon: Gavel },
] as const
type Tab = (typeof STATUS_TABS)[number]['key']

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function timeUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'expired'
  const h = Math.floor(ms / 3_600_000)
  const d = Math.floor(h / 24)
  if (d >= 1) return `${d}d left`
  return `${h}h left`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function VoteBar({ forVotes, againstVotes }: { forVotes: number; againstVotes: number }) {
  const total = forVotes + againstVotes
  const forPct = total > 0 ? (forVotes / total) * 100 : 50

  return (
    <div className="relative h-2 rounded-full overflow-hidden bg-surface-300/60">
      <motion.div
        className="absolute inset-y-0 left-0 bg-for-500 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${forPct}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  )
}

// ─── Propose Modal ─────────────────────────────────────────────────────────────

interface ProposeModalProps {
  onClose: () => void
  onCreated: (id: string) => void
}

function ProposeModal({ onClose, onCreated }: ProposeModalProps) {
  const [question, setQuestion] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<ReferendumCategory>('community')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/referendums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), description: description.trim(), category }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to propose referendum')
        return
      }
      onCreated(data.id)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose()
  }

  const charLeft = 200 - question.length
  const descLeft = 1500 - description.length

  return (
    <AnimatePresence>
      <motion.div
        ref={backdropRef}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleBackdrop}
      >
        <motion.div
          className="w-full max-w-lg bg-surface-100 border border-surface-300 rounded-2xl shadow-2xl overflow-hidden"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-300">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gold/10 border border-gold/30">
                <Landmark className="h-4 w-4 text-gold" />
              </div>
              <div>
                <h2 className="font-mono text-sm font-bold text-white">Propose a Referendum</h2>
                <p className="text-[11px] font-mono text-surface-500">Open for community vote · 7 days</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center h-7 w-7 rounded-lg hover:bg-surface-200 text-surface-500 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={submit} className="p-5 space-y-4">
            {/* Category */}
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-semibold text-surface-500 uppercase tracking-wide">
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(CATEGORY_CONFIG) as ReferendumCategory[]).map((cat) => {
                  const cfg = CATEGORY_CONFIG[cat]
                  const Icon = cfg.icon
                  const active = category === cat
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
                        'border transition-all',
                        active
                          ? `${cfg.bg} ${cfg.border} ${cfg.color}`
                          : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-700'
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Question */}
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-semibold text-surface-500 uppercase tracking-wide">
                Question <span className="text-against-400">*</span>
              </label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value.slice(0, 200))}
                placeholder="Should Lobby Market add a Mental Health category?"
                rows={2}
                required
                className="w-full bg-surface-200 border border-surface-300 rounded-xl px-4 py-3 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-gold/50 resize-none transition-colors"
              />
              <p className={cn('text-right text-[11px] font-mono', charLeft < 20 ? 'text-against-400' : 'text-surface-500')}>
                {charLeft} left
              </p>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-semibold text-surface-500 uppercase tracking-wide">
                Context <span className="text-surface-500 font-normal normal-case">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 1500))}
                placeholder="Why does this matter? What would change? Provide context for voters…"
                rows={4}
                className="w-full bg-surface-200 border border-surface-300 rounded-xl px-4 py-3 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-gold/50 resize-none transition-colors"
              />
              <p className={cn('text-right text-[11px] font-mono', descLeft < 100 ? 'text-against-400' : 'text-surface-500')}>
                {descLeft} left
              </p>
            </div>

            {/* Quorum note */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-200/60 border border-surface-300">
              <Info className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] font-mono text-surface-500 leading-relaxed">
                Referendums require <span className="text-white font-semibold">25 votes</span> to reach quorum
                and close with <span className="text-white font-semibold">≥55% FOR</span> to pass.
                You can have up to <span className="text-white font-semibold">2 open referendums</span> at once.
              </p>
            </div>

            {error && (
              <p className="text-xs font-mono text-against-400 text-center">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-10 rounded-xl border border-surface-300 text-sm font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || question.trim().length < 10}
                className={cn(
                  'flex-1 h-10 rounded-xl text-sm font-mono font-bold flex items-center justify-center gap-2',
                  'bg-gold text-black hover:brightness-110 transition-all',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}
                Propose
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Referendum Card ──────────────────────────────────────────────────────────

interface ReferendumCardProps {
  referendum: ReferendumRow
  onVote: (id: string, vote: 'for' | 'against') => void
  votingId: string | null
}

function ReferendumCard({ referendum: ref, onVote, votingId }: ReferendumCardProps) {
  const [expanded, setExpanded] = useState(false)
  const cfg = CATEGORY_CONFIG[ref.category]
  const CategoryIcon = cfg.icon
  const isBusy = votingId === ref.id
  const total = ref.total_votes
  const forPct = total > 0 ? Math.round((ref.for_votes / total) * 10) / 10 : 0
  const againstPct = total > 0 ? Math.round((ref.against_votes / total) * 10) / 10 : 0
  const quorumPct = Math.min(100, Math.round((total / ref.quorum_required) * 100))

  const isPassed = ref.status === 'passed'
  const isFailed = ref.status === 'failed'
  const isVetoed = ref.status === 'vetoed'
  const isClosed = ref.status !== 'open'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border transition-all duration-200',
        isPassed
          ? 'bg-emerald/5 border-emerald/30'
          : isFailed
          ? 'bg-against-500/5 border-against-500/20'
          : isVetoed
          ? 'bg-surface-300/20 border-surface-400/30'
          : 'bg-surface-100 border-surface-300 hover:border-surface-400'
      )}
    >
      <div className="p-4 sm:p-5">
        {/* Top row: category + status + time */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold',
            cfg.bg, cfg.border, cfg.color, 'border'
          )}>
            <CategoryIcon className="h-2.5 w-2.5" />
            {cfg.label}
          </span>

          {isPassed && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald/10 border border-emerald/30 text-emerald">
              <Check className="h-2.5 w-2.5" /> PASSED
            </span>
          )}
          {isFailed && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-against-500/10 border border-against-500/30 text-against-400">
              <X className="h-2.5 w-2.5" /> FAILED
            </span>
          )}
          {isVetoed && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-surface-300/40 border border-surface-400/30 text-surface-500">
              <Shield className="h-2.5 w-2.5" /> VETOED
            </span>
          )}
          {!isClosed && (
            <span className="ml-auto text-[11px] font-mono text-surface-500 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeUntil(ref.closes_at)}
            </span>
          )}
        </div>

        {/* Question */}
        <p className="text-sm sm:text-[15px] font-semibold text-white leading-snug mb-3">
          {ref.question}
        </p>

        {/* Description expand/collapse */}
        {ref.description && (
          <div className="mb-3">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-surface-700 transition-colors"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Hide context' : 'Read context'}
            </button>
            <AnimatePresence>
              {expanded && (
                <motion.p
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-2 text-xs text-surface-500 leading-relaxed overflow-hidden"
                >
                  {ref.description}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Vote bar */}
        <div className="space-y-2 mb-4">
          <VoteBar forVotes={ref.for_votes} againstVotes={ref.against_votes} />
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="flex items-center gap-1 text-for-400">
              <ThumbsUp className="h-3 w-3" />
              {ref.for_votes} FOR ({forPct.toFixed(1)}%)
            </span>
            <span className="text-surface-500">{total} votes</span>
            <span className="flex items-center gap-1 text-against-400">
              {againstPct.toFixed(1)}% ({ref.against_votes}) AGAINST
              <ThumbsDown className="h-3 w-3" />
            </span>
          </div>
        </div>

        {/* Quorum progress */}
        <div className="space-y-1 mb-4">
          <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              Quorum {total}/{ref.quorum_required}
            </span>
            <span>{quorumPct}%</span>
          </div>
          <div className="h-1 rounded-full bg-surface-300/60 overflow-hidden">
            <motion.div
              className={cn('h-full rounded-full', ref.quorum_met ? 'bg-emerald' : 'bg-gold')}
              initial={{ width: 0 }}
              animate={{ width: `${quorumPct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Proposer + vote buttons */}
        <div className="flex items-center gap-3">
          <Link href={`/profile/${ref.proposer_username}`} className="flex items-center gap-2 min-w-0 flex-1">
            <Avatar
              src={ref.proposer_avatar_url}
              fallback={ref.proposer_display_name || ref.proposer_username}
              size="xs"
            />
            <span className="text-[11px] font-mono text-surface-500 truncate">
              @{ref.proposer_username} · {relativeTime(ref.created_at)}
            </span>
          </Link>

          {!isClosed && (
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => onVote(ref.id, 'for')}
                disabled={isBusy}
                className={cn(
                  'flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-mono font-semibold',
                  'border transition-all disabled:opacity-60',
                  ref.user_vote === 'for'
                    ? 'bg-for-500 border-for-500 text-white'
                    : 'bg-for-500/10 border-for-500/30 text-for-400 hover:bg-for-500/20'
                )}
              >
                {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
                For
              </button>
              <button
                onClick={() => onVote(ref.id, 'against')}
                disabled={isBusy}
                className={cn(
                  'flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-mono font-semibold',
                  'border transition-all disabled:opacity-60',
                  ref.user_vote === 'against'
                    ? 'bg-against-500 border-against-500 text-white'
                    : 'bg-against-500/10 border-against-500/30 text-against-400 hover:bg-against-500/20'
                )}
              >
                {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsDown className="h-3 w-3" />}
                Against
              </button>
            </div>
          )}

          {isClosed && (
            <div className={cn(
              'flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-mono font-semibold border',
              isPassed
                ? 'bg-emerald/10 border-emerald/30 text-emerald'
                : 'bg-against-500/10 border-against-500/30 text-against-400'
            )}>
              {isPassed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              {isPassed ? 'Passed' : isFailed ? 'Failed' : 'Vetoed'}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReferendumClient() {
  const [data, setData] = useState<ReferendumsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('open')
  const [showPropose, setShowPropose] = useState(false)
  const [votingId, setVotingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/referendums?filter=all&limit=60')
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as ReferendumsResponse
      setData(json)
      setError(null)
    } catch {
      setError('Failed to load referendums. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function castVote(referendumId: string, vote: 'for' | 'against') {
    if (votingId) return
    setVotingId(referendumId)
    try {
      const res = await fetch(`/api/referendums/${referendumId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote }),
      })
      const result = await res.json()
      if (!res.ok) {
        alert(result.error ?? 'Failed to vote')
        return
      }

      // Optimistically update
      setData((prev) => {
        if (!prev) return prev
        const update = (list: ReferendumRow[]) =>
          list.map((r) =>
            r.id === referendumId
              ? {
                  ...r,
                  for_votes: result.for_votes ?? r.for_votes,
                  against_votes: result.against_votes ?? r.against_votes,
                  total_votes: result.total ?? r.total_votes,
                  for_pct: result.for_pct ?? r.for_pct,
                  user_vote: result.user_vote ?? r.user_vote,
                }
              : r
          )
        return { ...prev, open: update(prev.open), closed: update(prev.closed) }
      })
    } catch {
      alert('Network error. Please try again.')
    } finally {
      setVotingId(null)
    }
  }

  function handleCreated(_id: string) {
    setShowPropose(false)
    load()
  }

  const openRefs = data?.open ?? []
  const closedRefs = data?.closed ?? []
  const shown = tab === 'open' ? openRefs : closedRefs
  const passedCount = closedRefs.filter((r) => r.status === 'passed').length

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-28 md:pb-12">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-gold/10 border border-gold/30">
                <Landmark className="h-6 w-6 text-gold" />
              </div>
              <div>
                <h1 className="font-mono text-2xl sm:text-3xl font-bold text-white">
                  Civic Referendums
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Shape the platform · Govern together
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowPropose(true)}
              className="flex-shrink-0 flex items-center gap-2 px-4 h-10 rounded-xl bg-gold text-black text-sm font-mono font-bold hover:brightness-110 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Propose</span>
            </button>
          </div>

          {/* Stats strip */}
          {data && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Open', value: openRefs.length, icon: Vote, color: 'text-for-400' },
                { label: 'Passed', value: passedCount, icon: Check, color: 'text-emerald' },
                { label: 'Citizens', value: data.userCount.toLocaleString(), icon: Users, color: 'text-purple' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-surface-100 border border-surface-300">
                  <Icon className={cn('h-4 w-4', color)} />
                  <span className="font-mono text-lg font-bold text-white">{value}</span>
                  <span className="text-[11px] font-mono text-surface-500">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* How it works banner */}
        <div className="mb-6 p-4 rounded-2xl bg-gold/5 border border-gold/20 flex items-start gap-3">
          <Info className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
          <div className="text-xs font-mono text-surface-500 leading-relaxed space-y-1">
            <p>
              <span className="text-white font-semibold">Citizens propose</span> platform changes, new features, and community policies.
            </p>
            <p>
              A referendum <span className="text-emerald font-semibold">passes</span> when it reaches{' '}
              <span className="text-white font-semibold">25 votes</span> with{' '}
              <span className="text-white font-semibold">≥55% FOR</span> within 7 days.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-surface-200 border border-surface-300 mb-6">
          {STATUS_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-mono font-semibold transition-all',
                tab === key
                  ? 'bg-surface-50 text-white shadow-sm border border-surface-300'
                  : 'text-surface-500 hover:text-surface-700'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {key === 'open' && openRefs.length > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-for-500 text-white text-[9px] font-bold">
                  {openRefs.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <div className="flex items-center justify-end mb-4">
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>

        {/* Content */}
        {error && (
          <div className="p-4 rounded-xl bg-against-500/10 border border-against-500/20 text-sm font-mono text-against-400 text-center">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={tab === 'open' ? Vote : Trophy}
            iconColor={tab === 'open' ? 'text-for-400' : 'text-gold'}
            title={tab === 'open' ? 'No open referendums' : 'No closed referendums yet'}
            description={
              tab === 'open'
                ? 'Be the first to propose a referendum and shape Lobby Market.'
                : 'Referendums will appear here once they close.'
            }
            actions={
              tab === 'open'
                ? [{ label: 'Propose a Referendum', onClick: () => setShowPropose(true), variant: 'primary', icon: Plus }]
                : []
            }
          />
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {shown.map((ref) => (
                <ReferendumCard
                  key={ref.id}
                  referendum={ref}
                  onVote={castVote}
                  votingId={votingId}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Passed Mandates section on closed tab */}
        {tab === 'closed' && passedCount > 0 && (
          <div className="mt-8 p-4 rounded-2xl bg-emerald/5 border border-emerald/20">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-emerald" />
              <h3 className="font-mono text-sm font-bold text-emerald">People&rsquo;s Mandate</h3>
            </div>
            <p className="text-xs font-mono text-surface-500 leading-relaxed">
              {passedCount} referendum{passedCount === 1 ? '' : 's'} passed with community consensus.
              These mandates represent the collective will of Lobby Market citizens.
            </p>
          </div>
        )}
      </main>

      <BottomNav />

      {/* Propose modal */}
      {showPropose && (
        <ProposeModal onClose={() => setShowPropose(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}
