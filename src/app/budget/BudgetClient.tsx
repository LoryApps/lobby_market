'use client'

/**
 * /budget — The Civic Budget
 *
 * The governing coalition's annual allocation of civic resources across the
 * 10 categories. Citizens vote to APPROVE or REJECT the budget. The
 * opposition can propose line amendments. A rejected budget triggers a
 * confidence crisis.
 *
 * Related pages:
 *   /government    — proposing coalition
 *   /parliament    — full parliamentary hub
 *   /confidence    — motion of no confidence (triggered on rejection)
 *   /opposition    — opposition response
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Crown,
  FileText,
  Info,
  Landmark,
  Loader2,
  MessageSquare,
  MinusCircle,
  PlusCircle,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { CivicBudget, BudgetLine, BudgetAmendment } from '@/app/api/budget/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { color: string; bar: string; bg: string }> = {
  Politics:    { color: 'text-for-400',    bar: 'bg-for-500',      bg: 'bg-for-500/10' },
  Economics:   { color: 'text-gold',       bar: 'bg-gold',         bg: 'bg-gold/10' },
  Technology:  { color: 'text-purple',     bar: 'bg-purple',       bg: 'bg-purple/10' },
  Health:      { color: 'text-emerald',    bar: 'bg-emerald',      bg: 'bg-emerald/10' },
  Science:     { color: 'text-for-300',    bar: 'bg-for-400',      bg: 'bg-for-400/10' },
  Ethics:      { color: 'text-against-300',bar: 'bg-against-400',  bg: 'bg-against-400/10' },
  Culture:     { color: 'text-against-400',bar: 'bg-against-500',  bg: 'bg-against-500/10' },
  Philosophy:  { color: 'text-purple',     bar: 'bg-purple',       bg: 'bg-purple/10' },
  Education:   { color: 'text-for-400',    bar: 'bg-for-500',      bg: 'bg-for-500/10' },
  Environment: { color: 'text-emerald',    bar: 'bg-emerald',      bg: 'bg-emerald/10' },
}

const DEFAULT_META = { color: 'text-surface-400', bar: 'bg-surface-400', bg: 'bg-surface-400/10' }

const STATUS_CONFIG = {
  proposed:  { label: 'Proposed',  cls: 'bg-surface-300/20 border-surface-400/40 text-surface-400', icon: FileText },
  debating:  { label: 'Debating',  cls: 'bg-purple/10 border-purple/30 text-purple',                icon: MessageSquare },
  passed:    { label: 'Passed',    cls: 'bg-emerald/10 border-emerald/30 text-emerald',             icon: CheckCircle2 },
  failed:    { label: 'Rejected',  cls: 'bg-against-500/10 border-against-500/30 text-against-400', icon: XCircle },
  withdrawn: { label: 'Withdrawn', cls: 'bg-surface-300/20 border-surface-400/40 text-surface-400', icon: MinusCircle },
}

// Seed budget shown when no real budget exists yet
const SEED_BUDGET: CivicBudget = {
  id: '__seed__',
  fiscal_year: 2026,
  title: 'Civic Appropriations Act 2026',
  chancellor_statement:
    'This budget reflects the coalition\'s commitment to civic renewal — investing in the foundations of deliberative democracy while ensuring every category receives the attention the people demand. We propose a ten-point allocation calibrated to current voter priorities and debate intensity.',
  status: 'debating',
  votes_approve: 1847,
  votes_reject: 632,
  debate_ends_at: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
  resolved_at: null,
  created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  coalition_name: 'The Progressive Covenant',
  coalition_color: '#3b82f6',
  user_vote: null,
  amendments: [],
  lines: [
    { id: '1', category: 'Economics',   allocation: 18.5, description: 'Fiscal policy debate prioritisation, market regulation topics, and economic modelling grants.', change_pct: 2.5, priority_rank: 1 },
    { id: '2', category: 'Health',      allocation: 16.0, description: 'Public health topics, mental health frameworks, and universal healthcare debate infrastructure.', change_pct: 1.0, priority_rank: 2 },
    { id: '3', category: 'Environment', allocation: 14.5, description: 'Climate legislation tracking, green policy debates, and environmental impact assessments.', change_pct: 3.0, priority_rank: 3 },
    { id: '4', category: 'Technology',  allocation: 13.0, description: 'AI governance, digital rights, and technology regulation debate facilitation.', change_pct: 2.0, priority_rank: 4 },
    { id: '5', category: 'Education',   allocation: 12.0, description: 'Curriculum policy, university funding debates, and civic literacy programme support.', change_pct: -0.5, priority_rank: 5 },
    { id: '6', category: 'Politics',    allocation: 9.0,  description: 'Electoral reform, constitutional topics, and democratic process debates.', change_pct: -1.5, priority_rank: 6 },
    { id: '7', category: 'Ethics',      allocation: 7.5,  description: 'Bioethics, AI morality, and civic obligation debate frameworks.', change_pct: 0.5, priority_rank: 7 },
    { id: '8', category: 'Science',     allocation: 5.5,  description: 'Research policy, evidence-based legislation, and scientific consensus debates.', change_pct: -0.5, priority_rank: 8 },
    { id: '9', category: 'Culture',     allocation: 2.5,  description: 'Arts funding, heritage preservation, and cultural expression policy debates.', change_pct: -1.0, priority_rank: 9 },
    { id: '10', category: 'Philosophy', allocation: 1.5,  description: 'Foundational ethics, political philosophy, and constitutional theory debates.', change_pct: 0.0, priority_rank: 10 },
  ],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(diff)
  const past = diff < 0
  if (abs < 60_000) return 'just now'
  if (abs < 3_600_000) {
    const m = Math.round(abs / 60_000)
    return past ? `${m}m ago` : `${m}m remaining`
  }
  if (abs < 86_400_000) {
    const h = Math.round(abs / 3_600_000)
    return past ? `${h}h ago` : `${h}h remaining`
  }
  const d = Math.round(abs / 86_400_000)
  return past ? `${d}d ago` : `${d}d remaining`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function VoteBar({ approve, reject }: { approve: number; reject: number }) {
  const total = approve + reject
  const approvePct = total > 0 ? Math.round((approve / total) * 100) : 50
  const rejectPct = 100 - approvePct
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-surface-400">
        <span className="text-emerald font-medium">Approve {approvePct}%</span>
        <span className="text-against-400 font-medium">Reject {rejectPct}%</span>
      </div>
      <div className="h-3 rounded-full bg-surface-300 overflow-hidden flex">
        <motion.div
          className="h-full bg-emerald rounded-l-full"
          initial={{ width: 0 }}
          animate={{ width: `${approvePct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        <motion.div
          className="h-full bg-against-500 rounded-r-full"
          initial={{ width: 0 }}
          animate={{ width: `${rejectPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
        />
      </div>
      <div className="flex justify-between text-xs text-surface-500">
        <span>{approve.toLocaleString()} votes</span>
        <span>{reject.toLocaleString()} votes</span>
      </div>
    </div>
  )
}

// ─── Budget line row ──────────────────────────────────────────────────────────

function BudgetLineRow({ line, expanded, onToggle }: {
  line: BudgetLine
  expanded: boolean
  onToggle: () => void
}) {
  const meta = CATEGORY_META[line.category] ?? DEFAULT_META
  const isIncrease = line.change_pct > 0

  return (
    <motion.div
      layout
      className="rounded-xl border border-surface-300/40 overflow-hidden"
    >
      <button
        onClick={onToggle}
        className="w-full p-4 text-left hover:bg-surface-200/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn('w-1.5 h-10 rounded-full flex-shrink-0', meta.bar)} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className={cn('text-sm font-semibold', meta.color)}>
                {line.category}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                {line.change_pct !== 0 && (
                  <span className={cn(
                    'text-xs flex items-center gap-0.5',
                    isIncrease ? 'text-emerald' : 'text-against-400',
                  )}>
                    {isIncrease ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(line.change_pct).toFixed(1)}%
                  </span>
                )}
                <span className="text-white font-bold text-sm tabular-nums">
                  {line.allocation.toFixed(1)}%
                </span>
                {expanded ? <ChevronUp className="w-4 h-4 text-surface-500" /> : <ChevronDown className="w-4 h-4 text-surface-500" />}
              </div>
            </div>
            <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
              <motion.div
                className={cn('h-full rounded-full', meta.bar)}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, line.allocation * 4)}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn('px-4 pb-4 border-t border-surface-300/30', meta.bg)}
          >
            <p className="text-sm text-surface-300 leading-relaxed pt-3">
              {line.description}
            </p>
            {line.change_pct !== 0 && (
              <p className={cn(
                'text-xs mt-2 font-medium',
                isIncrease ? 'text-emerald' : 'text-against-400',
              )}>
                {isIncrease ? '+' : ''}{line.change_pct.toFixed(1)}% vs previous budget
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Amendment card ───────────────────────────────────────────────────────────

function AmendmentCard({
  amendment,
  onUpvote,
  upvoting,
}: {
  amendment: BudgetAmendment
  onUpvote: (id: string) => void
  upvoting: string | null
}) {
  const meta = CATEGORY_META[amendment.category] ?? DEFAULT_META

  return (
    <div className="rounded-xl border border-surface-300/40 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', meta.bg, meta.color, 'border-current/20')}>
            {amendment.category}
          </span>
          <span className="text-xs text-surface-400">
            {amendment.proposed_pct.toFixed(1)}% (amendment)
          </span>
        </div>
        <button
          onClick={() => !amendment.user_upvoted && onUpvote(amendment.id)}
          disabled={amendment.user_upvoted || upvoting === amendment.id}
          className={cn(
            'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all',
            amendment.user_upvoted
              ? 'border-for-500/50 text-for-400 bg-for-500/10'
              : 'border-surface-400/30 text-surface-400 hover:border-for-500/50 hover:text-for-300',
          )}
        >
          {upvoting === amendment.id
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <ThumbsUp className="w-3 h-3" />
          }
          {amendment.upvote_count}
        </button>
      </div>
      <p className="text-sm text-surface-300 leading-relaxed">{amendment.rationale}</p>
      <div className="flex items-center gap-2 text-xs text-surface-500">
        {amendment.proposer_avatar && (
          <Avatar src={amendment.proposer_avatar} username={amendment.proposer_username ?? ''} size="xs" />
        )}
        <span>{amendment.proposer_display ?? amendment.proposer_username ?? 'Citizen'}</span>
      </div>
    </div>
  )
}

// ─── Propose Amendment Modal ──────────────────────────────────────────────────

function ProposeAmendmentModal({
  budgetId,
  categories,
  onClose,
  onSuccess,
}: {
  budgetId: string
  categories: string[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [category, setCategory] = useState(categories[0] ?? 'Economics')
  const [pct, setPct] = useState<string>('')
  const [rationale, setRationale] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    const proposed_pct = parseFloat(pct)
    if (isNaN(proposed_pct) || proposed_pct < 0 || proposed_pct > 100) {
      setErr('Enter a valid percentage (0–100)')
      return
    }
    if (rationale.trim().length < 10) {
      setErr('Rationale must be at least 10 characters')
      return
    }
    setSubmitting(true)
    setErr(null)
    const res = await fetch('/api/budget/amend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'propose', budget_id: budgetId, category, proposed_pct, rationale }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setErr(j.error ?? 'Failed to submit amendment')
    } else {
      onSuccess()
    }
    setSubmitting(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-md bg-surface-100 border border-surface-300/50 rounded-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Propose Amendment</h3>
          <button onClick={onClose} className="p-1 text-surface-400 hover:text-white transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-surface-400 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-surface-200 border border-surface-300/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-for-500/50"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-surface-400 mb-1">Proposed Allocation (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              placeholder="e.g. 15.0"
              className="w-full bg-surface-200 border border-surface-300/50 rounded-lg px-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-for-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-surface-400 mb-1">Rationale</label>
            <textarea
              rows={3}
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              maxLength={400}
              placeholder="Why should this allocation change?"
              className="w-full bg-surface-200 border border-surface-300/50 rounded-lg px-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-for-500/50 resize-none"
            />
            <p className="text-right text-xs text-surface-500 mt-0.5">{rationale.length}/400</p>
          </div>
        </div>

        {err && <p className="text-xs text-against-400">{err}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-surface-400/30 text-sm text-surface-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="flex-1 py-2 rounded-lg bg-for-500 text-white text-sm font-semibold disabled:opacity-50 hover:bg-for-400 transition-colors flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit Amendment
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BudgetClient() {
  const [budget, setBudget] = useState<CivicBudget | null>(null)
  const [isSeed, setIsSeed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [_error, setError] = useState<string | null>(null)
  const [expandedLine, setExpandedLine] = useState<string | null>(null)
  const [voting, setVoting] = useState<'approve' | 'reject' | null>(null)
  const [upvoting, setUpvoting] = useState<string | null>(null)
  const [showAmendModal, setShowAmendModal] = useState(false)
  const [tab, setTab] = useState<'allocation' | 'amendments'>('allocation')
  const fetchedRef = useRef(false)

  const load = useCallback(async () => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/budget')
      if (!res.ok) throw new Error('Failed to load budget')
      const data = await res.json()
      if (data.seed || !data.budget) {
        setBudget(SEED_BUDGET)
        setIsSeed(true)
      } else {
        setBudget(data.budget)
      }
    } catch (_e) {
      setBudget(SEED_BUDGET)
      setIsSeed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function castVote(side: 'approve' | 'reject') {
    if (!budget || isSeed || budget.user_vote || voting) return
    setVoting(side)
    try {
      const res = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget_id: budget.id, side }),
      })
      if (res.ok) {
        setBudget((b) => b ? {
          ...b,
          user_vote: side,
          votes_approve: side === 'approve' ? b.votes_approve + 1 : b.votes_approve,
          votes_reject: side === 'reject' ? b.votes_reject + 1 : b.votes_reject,
        } : b)
      }
    } finally {
      setVoting(null)
    }
  }

  async function upvoteAmendment(id: string) {
    if (isSeed) return
    setUpvoting(id)
    try {
      await fetch('/api/budget/amend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upvote', amendment_id: id }),
      })
      setBudget((b) => b ? {
        ...b,
        amendments: b.amendments.map((a) =>
          a.id === id ? { ...a, upvote_count: a.upvote_count + 1, user_upvoted: true } : a,
        ),
      } : b)
    } finally {
      setUpvoting(null)
    }
  }

  function refreshAfterAmendment() {
    setShowAmendModal(false)
    fetchedRef.current = false
    load()
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-50">
        <TopBar />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className={i === 0 ? 'h-32' : 'h-16'} />
          ))}
        </main>
        <BottomNav />
      </div>
    )
  }

  if (!budget) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-50">
        <TopBar />
        <main className="flex-1 flex items-center justify-center text-surface-400">
          No budget found
        </main>
        <BottomNav />
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[budget.status] ?? STATUS_CONFIG.proposed
  const StatusIcon = statusCfg.icon
  const categories = budget.lines.map((l) => l.category)

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-6 pb-24">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-surface-500">
          <Link href="/parliament" className="hover:text-white transition-colors flex items-center gap-1">
            <Landmark className="w-3 h-3" />
            Parliament
          </Link>
          <ChevronDown className="w-3 h-3 rotate-[-90deg]" />
          <Link href="/government" className="hover:text-white transition-colors">Government</Link>
          <ChevronDown className="w-3 h-3 rotate-[-90deg]" />
          <span className="text-surface-300">Budget</span>
        </nav>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
              <BarChart3 className="w-6 h-6 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={cn(
                  'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium',
                  statusCfg.cls,
                )}>
                  <StatusIcon className="w-3 h-3" />
                  {statusCfg.label}
                </span>
                <span className="text-xs text-surface-500">FY {budget.fiscal_year}</span>
              </div>
              <h1 className="text-xl font-bold text-white leading-tight">{budget.title}</h1>
              {budget.coalition_name && (
                <p className="text-xs text-surface-400 mt-0.5">
                  Proposed by{' '}
                  <Link href="/government" className="text-for-400 hover:text-for-300 transition-colors">
                    {budget.coalition_name}
                  </Link>
                </p>
              )}
            </div>
          </div>

          {/* Chancellor's statement */}
          {budget.chancellor_statement && (
            <div className="rounded-xl border border-gold/20 bg-gold/5 p-4">
              <div className="flex items-start gap-2">
                <Crown className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                <blockquote className="text-sm text-surface-300 leading-relaxed italic">
                  &ldquo;{budget.chancellor_statement}&rdquo;
                </blockquote>
              </div>
            </div>
          )}

          {/* Seed notice */}
          {isSeed && (
            <div className="rounded-xl border border-surface-300/40 bg-surface-200/50 p-3 flex items-start gap-2">
              <Info className="w-4 h-4 text-surface-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-surface-400">
                No live budget yet — showing a sample proposal. When a governing coalition tables the real budget it will appear here.
              </p>
            </div>
          )}

          {/* Debate timer */}
          {budget.debate_ends_at && budget.status === 'debating' && (
            <div className="flex items-center gap-2 text-xs text-surface-400">
              <Clock className="w-3.5 h-3.5" />
              <span>Debate window: {formatRelative(budget.debate_ends_at)}</span>
            </div>
          )}
        </motion.div>

        {/* Vote tally */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-surface-300/40 bg-surface-100 p-5 space-y-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Scale className="w-4 h-4 text-surface-400" />
            <h2 className="text-sm font-semibold text-white">Parliamentary Vote</h2>
            <span className="ml-auto text-xs text-surface-500 flex items-center gap-1">
              <Users className="w-3 h-3" />
              {totalVotes.toLocaleString()} citizens voted
            </span>
          </div>

          <VoteBar approve={budget.votes_approve} reject={budget.votes_reject} />

          {/* Cast vote */}
          {!budget.user_vote && !isSeed && (budget.status === 'proposed' || budget.status === 'debating') && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => castVote('approve')}
                disabled={voting !== null}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald/10 border border-emerald/30 text-emerald text-sm font-semibold hover:bg-emerald/20 transition-all disabled:opacity-50"
              >
                {voting === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                Approve
              </button>
              <button
                onClick={() => castVote('reject')}
                disabled={voting !== null}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-against-500/10 border border-against-500/30 text-against-400 text-sm font-semibold hover:bg-against-500/20 transition-all disabled:opacity-50"
              >
                {voting === 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsDown className="w-4 h-4" />}
                Reject
              </button>
            </div>
          )}

          {budget.user_vote && (
            <div className={cn(
              'flex items-center gap-2 text-sm font-medium py-2 px-3 rounded-lg border',
              budget.user_vote === 'approve'
                ? 'bg-emerald/10 border-emerald/30 text-emerald'
                : 'bg-against-500/10 border-against-500/30 text-against-400',
            )}>
              <CheckCircle2 className="w-4 h-4" />
              You voted to {budget.user_vote === 'approve' ? 'Approve' : 'Reject'} this budget
            </div>
          )}

          {budget.status === 'passed' && (
            <div className="flex items-center gap-2 text-sm text-emerald bg-emerald/10 border border-emerald/20 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4" />
              Budget passed — {formatDate(budget.resolved_at ?? budget.created_at)}
            </div>
          )}
          {budget.status === 'failed' && (
            <div className="flex items-center gap-2 text-sm text-against-400 bg-against-500/10 border border-against-500/20 rounded-lg px-3 py-2">
              <XCircle className="w-4 h-4" />
              Budget rejected — government must revise.{' '}
              <Link href="/confidence" className="underline underline-offset-2">Motion of No Confidence?</Link>
            </div>
          )}
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 bg-surface-200 rounded-xl p-1">
          {(['allocation', 'amendments'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 py-2 text-sm font-medium rounded-lg transition-all',
                tab === t
                  ? 'bg-surface-100 text-white shadow-sm'
                  : 'text-surface-400 hover:text-surface-300',
              )}
            >
              {t === 'allocation' ? (
                <span className="flex items-center justify-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" /> Allocation
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Amendments
                  {budget.amendments.length > 0 && (
                    <span className="bg-for-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center leading-none">
                      {budget.amendments.length}
                    </span>
                  )}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Allocation tab */}
        <AnimatePresence mode="wait">
          {tab === 'allocation' && (
            <motion.div
              key="allocation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              <p className="text-xs text-surface-500 mb-3">
                {budget.lines.length} categories · total allocation{' '}
                {budget.lines.reduce((s, l) => s + l.allocation, 0).toFixed(1)}%
              </p>
              {budget.lines.map((line) => (
                <BudgetLineRow
                  key={line.id}
                  line={line}
                  expanded={expandedLine === line.id}
                  onToggle={() => setExpandedLine((id) => id === line.id ? null : line.id)}
                />
              ))}
            </motion.div>
          )}

          {tab === 'amendments' && (
            <motion.div
              key="amendments"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {!isSeed && (budget.status === 'proposed' || budget.status === 'debating') && (
                <button
                  onClick={() => setShowAmendModal(true)}
                  className="w-full py-3 rounded-xl border border-dashed border-surface-400/40 text-sm text-surface-400 hover:border-for-500/50 hover:text-for-300 transition-all flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  Propose an Amendment
                </button>
              )}

              {budget.amendments.length === 0 ? (
                <div className="text-center py-12 text-surface-500">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No amendments yet</p>
                  <p className="text-xs mt-1 text-surface-600">Be the first to propose a change to the budget</p>
                </div>
              ) : (
                budget.amendments.map((a) => (
                  <AmendmentCard
                    key={a.id}
                    amendment={a}
                    onUpvote={upvoteAmendment}
                    upvoting={upvoting}
                  />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Related pages */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-surface-300/40 bg-surface-100 p-4"
        >
          <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Related</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: '/parliament',  icon: Landmark,     label: 'Parliament' },
              { href: '/government',  icon: Crown,        label: 'Government' },
              { href: '/opposition',  icon: Scale,        label: 'Opposition' },
              { href: '/confidence',  icon: AlertTriangle, label: 'No Confidence' },
            ].map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 p-3 rounded-xl border border-surface-300/30 hover:border-for-500/40 hover:bg-surface-200/50 transition-all text-sm text-surface-300 hover:text-white"
              >
                <Icon className="w-4 h-4 text-surface-500" />
                {label}
              </Link>
            ))}
          </div>
        </motion.div>

      </main>

      <BottomNav />

      {/* Amendment modal */}
      <AnimatePresence>
        {showAmendModal && budget && (
          <ProposeAmendmentModal
            budgetId={budget.id}
            categories={categories}
            onClose={() => setShowAmendModal(false)}
            onSuccess={refreshAfterAmendment}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
