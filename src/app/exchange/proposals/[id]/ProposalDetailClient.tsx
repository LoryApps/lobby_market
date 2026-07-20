'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Gavel,
  Loader2,
  Share2,
  Tag,
  ThumbsUp,
  TrendingUp,
  User,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { ProposalDetail, SimilarMarket } from '@/app/api/exchange/proposals/[id]/route'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function priceColor(price: number): string {
  if (price >= 67) return 'text-for-400'
  if (price >= 55) return 'text-for-300'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending: {
    label: 'Pending Review',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    icon: Clock,
    desc: 'This proposal is awaiting community votes before editorial review.',
  },
  accepted: {
    label: 'Accepted',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    icon: CheckCircle2,
    desc: 'This proposal was accepted and turned into a live market.',
  },
  rejected: {
    label: 'Rejected',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    icon: XCircle,
    desc: 'This proposal was rejected by the editorial team.',
  },
  duplicate: {
    label: 'Duplicate',
    color: 'text-surface-400',
    bg: 'bg-surface-300/20',
    border: 'border-surface-300/30',
    icon: Copy,
    desc: 'A similar market already exists on the Exchange.',
  },
} as const

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function ProposalSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-3/4" />
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}

// ─── Similar Market Card ───────────────────────────────────────────────────────

function SimilarMarketCard({ market }: { market: SimilarMarket }) {
  const price = Math.round(market.price)
  const priceStr = `${price}¢`

  return (
    <Link
      href={`/exchange/${market.id}`}
      className="flex items-start gap-3 rounded-lg border border-surface-200 bg-surface-100 p-3 hover:border-surface-300 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs text-surface-700 leading-snug line-clamp-2">
          {market.statement}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs text-surface-500">
            <BarChart2 className="inline w-3 h-3 mr-0.5" />
            {formatVolume(market.volume)} votes
          </span>
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        <div className={cn('text-sm font-bold tabular-nums', priceColor(price))}>
          {priceStr}
        </div>
        <div className="text-xs text-surface-500 mt-0.5">
          <ChevronRight className="inline w-3 h-3" />
        </div>
      </div>
    </Link>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────

interface Props {
  proposalId: string
}

export function ProposalDetailClient({ proposalId }: Props) {
  const router = useRouter()
  const [proposal, setProposal] = useState<ProposalDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exchange/proposals/${proposalId}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        if (res.status === 404) {
          setError('Proposal not found.')
        } else {
          setError('Failed to load proposal.')
        }
        return
      }
      const data: ProposalDetail = await res.json()
      setProposal(data)
    } catch {
      setError('Failed to load proposal.')
    } finally {
      setLoading(false)
    }
  }, [proposalId])

  useEffect(() => {
    load()
  }, [load])

  const handleVote = useCallback(async () => {
    if (!proposal || voting) return
    setVoting(true)
    const action = proposal.viewer_voted ? 'remove' : 'up'
    try {
      const res = await fetch('/api/exchange/proposals/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id: proposal.id, action }),
      })
      if (res.ok) {
        const { upvotes } = await res.json()
        setProposal((p) =>
          p ? { ...p, upvotes, viewer_voted: action === 'up' } : p,
        )
      }
    } finally {
      setVoting(false)
    }
  }, [proposal, voting])

  const handleShare = useCallback(async () => {
    const url = window.location.href
    if (navigator.share) {
      await navigator.share({ title: proposal?.title ?? 'Market Proposal', url })
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [proposal])

  const statusConfig = proposal
    ? STATUS_CONFIG[proposal.status] ?? STATUS_CONFIG.pending
    : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-28">
        {/* Back nav */}
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Proposals
          </button>
        </div>

        {loading ? (
          <ProposalSkeleton />
        ) : error ? (
          <div className="rounded-xl border border-surface-200 bg-surface-100 p-8 text-center">
            <XCircle className="w-8 h-8 text-against-400 mx-auto mb-3" />
            <p className="text-surface-400 text-sm">{error}</p>
            <Button
              variant="surface"
              size="sm"
              className="mt-4"
              onClick={load}
            >
              Try again
            </Button>
          </div>
        ) : proposal && statusConfig ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Header */}
            <div className="rounded-xl border border-surface-200 bg-surface-100 p-5">
              {/* Category + status */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {proposal.category && (
                  <span className="inline-flex items-center gap-1 text-xs text-surface-400">
                    <Tag className="w-3 h-3" />
                    {proposal.category}
                  </span>
                )}
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border',
                    statusConfig.color,
                    statusConfig.bg,
                    statusConfig.border,
                  )}
                >
                  <statusConfig.icon className="w-3 h-3" />
                  {statusConfig.label}
                </span>
              </div>

              {/* Title */}
              <h1 className="text-lg font-bold text-white leading-snug mb-3">
                {proposal.title}
              </h1>

              {/* Upvote + share row */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleVote}
                  disabled={voting}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all',
                    proposal.viewer_voted
                      ? 'border-for-500/50 bg-for-500/10 text-for-400'
                      : 'border-surface-300 bg-surface-200 text-surface-400 hover:border-for-500/30 hover:text-for-400',
                    voting && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  {voting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ThumbsUp className="w-4 h-4" />
                  )}
                  <span className="tabular-nums">{proposal.upvotes}</span>
                  <span>{proposal.viewer_voted ? 'Upvoted' : 'Upvote'}</span>
                </button>

                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-surface-300 bg-surface-200 text-surface-400 hover:text-white text-sm transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  {copied ? 'Copied!' : 'Share'}
                </button>
              </div>
            </div>

            {/* Status callout */}
            <div
              className={cn(
                'rounded-xl border p-4',
                statusConfig.bg,
                statusConfig.border,
              )}
            >
              <p className={cn('text-sm', statusConfig.color)}>
                {statusConfig.desc}
              </p>

              {/* Rejection reason */}
              {proposal.status === 'rejected' && proposal.rejection_reason && (
                <p className="mt-2 text-xs text-against-300">
                  <span className="font-semibold">Reason: </span>
                  {proposal.rejection_reason}
                </p>
              )}

              {/* Link to live market if accepted */}
              {proposal.status === 'accepted' && proposal.topic_id && (
                <Link
                  href={`/exchange/${proposal.topic_id}`}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm text-emerald hover:text-emerald/80 font-medium"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View live market
                </Link>
              )}
            </div>

            {/* Description */}
            {proposal.description && (
              <div className="rounded-xl border border-surface-200 bg-surface-100 p-5">
                <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
                  Description
                </h2>
                <p className="text-sm text-surface-700 leading-relaxed whitespace-pre-line">
                  {proposal.description}
                </p>
              </div>
            )}

            {/* Resolution criteria */}
            {proposal.resolution_criteria && (
              <div className="rounded-xl border border-surface-200 bg-surface-100 p-5">
                <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
                  Resolution Criteria
                </h2>
                <p className="text-sm text-surface-700 leading-relaxed">
                  {proposal.resolution_criteria}
                </p>
              </div>
            )}

            {/* Meta grid */}
            <div className="rounded-xl border border-surface-200 bg-surface-100 p-5">
              <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
                Details
              </h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {proposal.estimated_settlement_date && (
                  <>
                    <dt className="flex items-center gap-1.5 text-surface-500">
                      <Calendar className="w-3.5 h-3.5" />
                      Est. Settlement
                    </dt>
                    <dd className="text-white font-medium">
                      {formatDateShort(proposal.estimated_settlement_date)}
                    </dd>
                  </>
                )}
                <dt className="flex items-center gap-1.5 text-surface-500">
                  <Clock className="w-3.5 h-3.5" />
                  Proposed
                </dt>
                <dd className="text-white font-medium">
                  {formatDate(proposal.created_at)}
                </dd>
                <dt className="flex items-center gap-1.5 text-surface-500">
                  <ThumbsUp className="w-3.5 h-3.5" />
                  Upvotes
                </dt>
                <dd className="text-white font-bold tabular-nums">
                  {proposal.upvotes.toLocaleString()}
                </dd>
              </dl>
            </div>

            {/* Author */}
            <div className="rounded-xl border border-surface-200 bg-surface-100 p-5">
              <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
                Proposed by
              </h2>
              <Link
                href={`/profile/${proposal.author.username}`}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                <Avatar
                  src={proposal.author.avatar_url}
                  username={proposal.author.username}
                  size="md"
                />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {proposal.author.display_name ?? proposal.author.username}
                  </p>
                  <p className="text-xs text-surface-500">@{proposal.author.username}</p>
                </div>
                <div className="ml-auto flex items-center gap-3 text-xs text-surface-500">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-gold" />
                    {proposal.author.clout.toLocaleString()}
                  </span>
                  {proposal.author.vote_count > 0 && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {proposal.author.vote_count.toLocaleString()} votes
                    </span>
                  )}
                </div>
              </Link>
            </div>

            {/* Similar markets */}
            {proposal.similar_markets.length > 0 && (
              <div className="rounded-xl border border-surface-200 bg-surface-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
                    Similar Live Markets
                  </h2>
                  <Link
                    href={`/exchange?category=${encodeURIComponent(proposal.category ?? '')}`}
                    className="text-xs text-for-400 hover:text-for-300"
                  >
                    Browse all
                  </Link>
                </div>
                <div className="space-y-2">
                  {proposal.similar_markets.map((m) => (
                    <SimilarMarketCard key={m.id} market={m} />
                  ))}
                </div>
              </div>
            )}

            {/* Action footer */}
            <div className="rounded-xl border border-surface-200 bg-surface-100 p-4">
              <p className="text-xs text-surface-500 text-center mb-3">
                Have a different idea?
              </p>
              <Link href="/exchange/propose" className="block">
                <Button variant="surface" size="sm" className="w-full">
                  <Gavel className="w-4 h-4" />
                  Submit your own proposal
                </Button>
              </Link>
              <Link href="/exchange/proposals" className="block mt-2">
                <Button variant="ghost" size="sm" className="w-full text-surface-500">
                  <TrendingUp className="w-4 h-4" />
                  Browse all proposals
                </Button>
              </Link>
            </div>
          </motion.div>
        ) : null}
      </main>

      <BottomNav />
    </div>
  )
}
