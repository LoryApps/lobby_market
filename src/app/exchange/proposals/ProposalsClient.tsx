'use client'

/**
 * /exchange/proposals — Community Market Proposals
 *
 * Browse proposals for new civic prediction markets submitted by the community.
 * Users upvote the proposals they want to see added to the live Exchange.
 * Top-upvoted proposals are reviewed and may become live topics.
 *
 * Tabs: Pending | Accepted | Rejected
 * Sort: Top (upvotes) | New (recent)
 * Filter: category
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Flame,
  Lightbulb,
  Loader2,
  PenLine,
  RefreshCw,
  Tag,
  ThumbsUp,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MarketProposal, ProposalsResponse } from '@/app/api/exchange/proposals/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const STATUS_TABS = [
  { id: 'pending',  label: 'Pending',  icon: Clock },
  { id: 'accepted', label: 'Accepted', icon: CheckCircle2 },
  { id: 'rejected', label: 'Rejected', icon: XCircle },
] as const
type StatusMode = (typeof STATUS_TABS)[number]['id']

const SORT_TABS = [
  { id: 'top', label: 'Top', icon: Flame },
  { id: 'new', label: 'New', icon: Clock },
] as const
type SortMode = (typeof SORT_TABS)[number]['id']

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pending',   color: 'text-gold',        bg: 'bg-gold/10' },
  accepted:  { label: 'Accepted',  color: 'text-emerald',     bg: 'bg-emerald/10' },
  rejected:  { label: 'Rejected',  color: 'text-against-400', bg: 'bg-against-500/10' },
  duplicate: { label: 'Duplicate', color: 'text-surface-400', bg: 'bg-surface-300/10' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatSettlement(date: string | null) {
  if (!date) return null
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Proposal Card ────────────────────────────────────────────────────────────

interface ProposalCardProps {
  proposal: MarketProposal
  onVote: (id: string, voted: boolean) => void
  voting: boolean
}

function ProposalCard({ proposal, onVote, voting }: ProposalCardProps) {
  const style = STATUS_STYLE[proposal.status] ?? STATUS_STYLE.pending
  const settlement = formatSettlement(proposal.estimated_settlement_date)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-surface-200 bg-surface-100 p-4 hover:border-surface-300 transition-colors"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-2 mb-2">
            {proposal.category && (
              <span className="inline-flex items-center gap-1 text-xs text-surface-400">
                <Tag className="w-3 h-3" />
                {proposal.category}
              </span>
            )}
            {settlement && (
              <span className="inline-flex items-center gap-1 text-xs text-surface-400">
                <Calendar className="w-3 h-3" />
                Settles {settlement}
              </span>
            )}
          </div>
          <Link
            href={`/exchange/proposals/${proposal.id}`}
            className="text-sm font-semibold text-white leading-snug hover:text-for-300 transition-colors"
          >
            {proposal.title}
          </Link>
        </div>

        {/* Upvote button */}
        <button
          onClick={() => onVote(proposal.id, proposal.viewer_voted)}
          disabled={voting}
          className={cn(
            'flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg border transition-all min-w-[44px]',
            proposal.viewer_voted
              ? 'border-for-500/50 bg-for-500/10 text-for-400'
              : 'border-surface-300 bg-surface-200 text-surface-400 hover:border-for-500/30 hover:text-for-400',
            voting && 'opacity-60 cursor-not-allowed'
          )}
        >
          <ThumbsUp className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold">{proposal.upvotes}</span>
        </button>
      </div>

      {/* Description */}
      {proposal.description && (
        <p className="mt-2 text-xs text-surface-400 line-clamp-2 leading-relaxed">
          {proposal.description}
        </p>
      )}

      {/* Resolution criteria */}
      {proposal.resolution_criteria && (
        <div className="mt-2 rounded-md bg-surface-200 px-2.5 py-1.5">
          <p className="text-xs text-surface-400">
            <span className="text-surface-500 font-medium">Resolves when: </span>
            {proposal.resolution_criteria}
          </p>
        </div>
      )}

      {/* Rejection reason */}
      {proposal.rejection_reason && (
        <div className="mt-2 rounded-md bg-against-500/10 border border-against-500/20 px-2.5 py-1.5">
          <p className="text-xs text-against-400">
            <span className="font-medium">Rejected: </span>
            {proposal.rejection_reason}
          </p>
        </div>
      )}

      {/* Accepted link */}
      {proposal.status === 'accepted' && proposal.topic_id && (
        <div className="mt-2">
          <Link
            href={`/exchange/${proposal.topic_id}`}
            className="inline-flex items-center gap-1 text-xs text-for-400 hover:text-for-300"
          >
            <BarChart2 className="w-3 h-3" />
            View live market
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar
            src={proposal.author?.avatar_url ?? null}
            fallback={proposal.author?.username?.[0]?.toUpperCase() ?? '?'}
            size="xs"
          />
          <Link
            href={`/profile/${proposal.author?.username}`}
            className="text-xs text-surface-400 hover:text-white transition-colors"
          >
            {proposal.author?.display_name ?? proposal.author?.username}
          </Link>
          <span className="text-xs text-surface-500">{formatDate(proposal.created_at)}</span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/exchange/proposals/${proposal.id}`}
            className="text-xs text-surface-500 hover:text-for-400 transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', style.bg, style.color)}>
            {style.label}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProposalSkeleton() {
  return (
    <div className="rounded-xl border border-surface-200 bg-surface-100 p-4">
      <div className="flex justify-between gap-3">
        <div className="flex-1">
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-4 w-full mb-1" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <Skeleton className="h-12 w-10 rounded-lg" />
      </div>
      <Skeleton className="h-3 w-full mt-2" />
      <Skeleton className="h-3 w-2/3 mt-1" />
      <div className="flex justify-between mt-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProposalsClient() {
  const [proposals, setProposals] = useState<MarketProposal[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [statusMode, setStatusMode] = useState<StatusMode>('pending')
  const [sortMode, setSortMode] = useState<SortMode>('top')
  const [category, setCategory] = useState<string | null>(null)
  const [votingIds, setVotingIds] = useState<Set<string>>(new Set())
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)
  const offsetRef = useRef(0)

  const fetchProposals = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true)
      offsetRef.current = 0
    } else {
      setLoadingMore(true)
    }

    const params = new URLSearchParams({
      sort: sortMode,
      status: statusMode,
      limit: '20',
      offset: String(offsetRef.current),
    })
    if (category) params.set('category', category)

    try {
      const res = await fetch(`/api/exchange/proposals?${params}`)
      const json: ProposalsResponse = await res.json()
      if (reset) {
        setProposals(json.proposals)
      } else {
        setProposals((p) => [...p, ...json.proposals])
      }
      setTotal(json.total)
      setHasMore(json.has_more)
      offsetRef.current += json.proposals.length
    } catch {
      // silent
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [sortMode, statusMode, category])

  useEffect(() => {
    fetchProposals(true)
  }, [fetchProposals])

  const handleVote = useCallback(async (id: string, alreadyVoted: boolean) => {
    setVotingIds((s) => new Set([...s, id]))
    try {
      const res = await fetch('/api/exchange/proposals/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id: id, action: alreadyVoted ? 'remove' : 'up' }),
      })
      const { upvotes } = await res.json()
      setProposals((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, upvotes, viewer_voted: !alreadyVoted } : p
        )
      )
    } catch {
      // silent
    } finally {
      setVotingIds((s) => { const n = new Set(s); n.delete(id); return n })
    }
  }, [])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-20 pb-28">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/exchange" className="p-2 rounded-lg hover:bg-surface-200 transition-colors">
            <ArrowLeft className="w-4 h-4 text-surface-400" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-gold" />
              Market Proposals
            </h1>
            <p className="text-xs text-surface-400 mt-0.5">
              Vote on community proposals · top picks become live markets
            </p>
          </div>
          <Link href="/exchange/propose">
            <Button size="sm" variant="for">
              <PenLine className="w-3.5 h-3.5" />
              Propose
            </Button>
          </Link>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 p-1 bg-surface-100 rounded-xl mb-4">
          {STATUS_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setStatusMode(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-all',
                statusMode === id
                  ? 'bg-surface-200 text-white'
                  : 'text-surface-400 hover:text-white'
              )}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-2 mb-5">
          {/* Sort */}
          <div className="flex gap-1 p-1 bg-surface-100 rounded-lg">
            {SORT_TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSortMode(id)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all',
                  sortMode === id ? 'bg-surface-200 text-white' : 'text-surface-400 hover:text-white'
                )}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <div className="relative">
            <button
              onClick={() => setShowCategoryMenu((s) => !s)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
                category
                  ? 'border-for-500/40 bg-for-500/10 text-for-400'
                  : 'border-surface-300 bg-surface-100 text-surface-400 hover:text-white'
              )}
            >
              <Tag className="w-3 h-3" />
              {category ?? 'Category'}
              <ChevronDown className="w-3 h-3" />
            </button>

            <AnimatePresence>
              {showCategoryMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full left-0 mt-1 w-44 bg-surface-100 border border-surface-200 rounded-xl shadow-xl z-20 py-1"
                >
                  <button
                    onClick={() => { setCategory(null); setShowCategoryMenu(false) }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs hover:bg-surface-200 transition-colors',
                      !category ? 'text-for-400' : 'text-surface-400'
                    )}
                  >
                    All categories
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setCategory(cat); setShowCategoryMenu(false) }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs hover:bg-surface-200 transition-colors',
                        category === cat ? 'text-for-400' : 'text-surface-400'
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Refresh */}
          <button
            onClick={() => fetchProposals(true)}
            disabled={loading}
            className="ml-auto p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-200 transition-colors"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Total */}
        {!loading && (
          <p className="text-xs text-surface-500 mb-4">
            {total.toLocaleString()} proposal{total !== 1 ? 's' : ''}
          </p>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <ProposalSkeleton key={i} />)}
          </div>
        ) : proposals.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title="No proposals yet"
            description={statusMode === 'pending'
              ? 'Be the first to propose a new civic prediction market.'
              : `No ${statusMode} proposals.`}
            action={
              statusMode === 'pending'
                ? <Link href="/exchange/propose"><Button variant="for" size="sm"><PenLine className="w-3.5 h-3.5" /> Propose a market</Button></Link>
                : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {proposals.map((p) => (
              <ProposalCard
                key={p.id}
                proposal={p}
                onVote={handleVote}
                voting={votingIds.has(p.id)}
              />
            ))}

            {hasMore && (
              <div className="text-center pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fetchProposals(false)}
                  disabled={loadingMore}
                >
                  {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Load more'}
                </Button>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
