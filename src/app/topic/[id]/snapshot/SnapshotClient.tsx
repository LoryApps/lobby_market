'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Share2,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Minus,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SnapshotArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  author_username: string | null
}

interface SnapshotStats {
  totalArguments: number
  totalSources: number
  totalContributors: number
  totalPredictions: number
}

interface SnapshotClientProps {
  topicId: string
  statement: string
  category: string | null
  status: string
  forPct: number
  totalVotes: number
  topForArg: SnapshotArgument | null
  topAgainstArg: SnapshotArgument | null
  stats: SnapshotStats
  createdAt: string
  updatedAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'Established Law',
  failed: 'Failed',
  continued: 'Continued',
  archived: 'Archived',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
  continued: 'proposed',
  archived: 'proposed',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

// ─── Share Button ─────────────────────────────────────────────────────────────

function ShareButton({ statement, topicId }: { statement: string; topicId: string }) {
  const [copied, setCopied] = useState(false)

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/topic/${topicId}/snapshot`
    const shareData = {
      title: statement,
      text: `Debate snapshot: ${statement}`,
      url,
    }

    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData)
        return
      } catch {
        // fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // nothing
    }
  }, [statement, topicId])

  return (
    <button
      onClick={handleShare}
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
        copied
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          : 'bg-surface-200 hover:bg-surface-300 text-surface-900 border border-surface-300/50'
      )}
    >
      {copied ? (
        <>
          <Check className="w-4 h-4" />
          Copied
        </>
      ) : (
        <>
          <Share2 className="w-4 h-4" />
          Share Snapshot
        </>
      )}
    </button>
  )
}

// ─── Vote Bar ─────────────────────────────────────────────────────────────────

function VoteBar({ forPct }: { forPct: number }) {
  const againstPct = 100 - forPct

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm font-semibold">
        <span className="text-for-400">{forPct.toFixed(1)}% FOR</span>
        <span className="text-against-400">{againstPct.toFixed(1)}% AGAINST</span>
      </div>
      <div className="h-3 rounded-full bg-surface-200 overflow-hidden flex">
        <motion.div
          className="h-full bg-gradient-to-r from-for-500 to-for-400 rounded-l-full"
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        <motion.div
          className="h-full bg-gradient-to-r from-against-400 to-against-500 flex-1 rounded-r-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        />
      </div>
    </div>
  )
}

// ─── Argument Card ────────────────────────────────────────────────────────────

function ArgumentCard({
  argument,
  side,
}: {
  argument: SnapshotArgument | null
  side: 'blue' | 'red'
}) {
  const isFor = side === 'blue'

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 flex flex-col gap-3 min-h-[140px]',
        isFor
          ? 'bg-for-500/5 border-for-500/20'
          : 'bg-against-500/5 border-against-500/20'
      )}
    >
      <div className={cn('flex items-center gap-2', isFor ? 'text-for-400' : 'text-against-400')}>
        {isFor ? <ThumbsUp className="w-3.5 h-3.5" /> : <ThumbsDown className="w-3.5 h-3.5" />}
        <span className="text-xs font-bold uppercase tracking-wider">
          {isFor ? 'Top FOR' : 'Top AGAINST'}
        </span>
        {argument && (
          <span className="ml-auto text-xs opacity-70">▲ {formatNum(argument.upvotes)}</span>
        )}
      </div>

      {argument ? (
        <>
          <p className="text-sm text-surface-900 leading-relaxed line-clamp-4 flex-1">
            {argument.content}
          </p>
          {argument.author_username && (
            <p className="text-xs text-surface-600">— @{argument.author_username}</p>
          )}
        </>
      ) : (
        <p className="text-sm text-surface-600 italic flex-1">
          No arguments yet. Be the first to make the case{isFor ? ' for' : ' against'} this debate.
        </p>
      )}
    </div>
  )
}

// ─── Stat Tile ────────────────────────────────────────────────────────────────

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface-100 border border-surface-300/50 rounded-2xl p-3 text-center">
      <div className="text-lg font-bold text-surface-900">{value}</div>
      <div className="text-xs text-surface-600 mt-0.5">{label}</div>
    </div>
  )
}

// ─── Consensus Label ──────────────────────────────────────────────────────────

function ConsensusLabel({ forPct }: { forPct: number }) {
  if (forPct >= 70) {
    return (
      <span className="flex items-center gap-1 text-for-400 font-medium text-sm">
        <TrendingUp className="w-4 h-4" />
        Strong FOR consensus
      </span>
    )
  }
  if (forPct >= 55) {
    return (
      <span className="flex items-center gap-1 text-for-400 font-medium text-sm">
        <TrendingUp className="w-3.5 h-3.5" />
        Leaning FOR
      </span>
    )
  }
  if (forPct <= 30) {
    return (
      <span className="flex items-center gap-1 text-against-400 font-medium text-sm">
        <TrendingDown className="w-4 h-4" />
        Strong AGAINST consensus
      </span>
    )
  }
  if (forPct <= 45) {
    return (
      <span className="flex items-center gap-1 text-against-400 font-medium text-sm">
        <TrendingDown className="w-3.5 h-3.5" />
        Leaning AGAINST
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-surface-600 font-medium text-sm">
      <Minus className="w-4 h-4" />
      Divided — too close to call
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SnapshotClient({
  topicId,
  statement,
  category,
  status,
  forPct,
  totalVotes,
  topForArg,
  topAgainstArg,
  stats,
  createdAt,
  updatedAt,
}: SnapshotClientProps) {
  const badgeVariant = STATUS_BADGE[status] ?? 'proposed'
  const statusLabel = STATUS_LABEL[status] ?? status

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-10">
        {/* Back nav */}
        <Link
          href={`/topic/${topicId}`}
          className="inline-flex items-center gap-1.5 text-sm text-surface-600 hover:text-surface-900 transition-colors mb-5"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to debate
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-5"
        >
          {/* Header */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={badgeVariant}>{statusLabel}</Badge>
              {category && (
                <span className="text-xs text-surface-600 uppercase tracking-wider font-medium">
                  {category}
                </span>
              )}
              <span className="text-xs text-surface-600 ml-auto">
                Snapshot · {formatDate(updatedAt)}
              </span>
            </div>

            <h1 className="text-xl font-bold text-surface-900 leading-snug">{statement}</h1>

            <ConsensusLabel forPct={forPct} />
          </div>

          {/* Vote bar */}
          <div className="bg-surface-100 border border-surface-300/50 rounded-2xl p-4">
            <VoteBar forPct={forPct} />
            <p className="text-xs text-surface-600 text-center mt-2">
              {formatNum(totalVotes)} votes cast
            </p>
          </div>

          {/* Arguments */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ArgumentCard argument={topForArg} side="blue" />
            <ArgumentCard argument={topAgainstArg} side="red" />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Arguments" value={formatNum(stats.totalArguments)} />
            <StatTile label="Sources" value={formatNum(stats.totalSources)} />
            <StatTile label="Contributors" value={formatNum(stats.totalContributors)} />
          </div>

          {/* Debate started */}
          <p className="text-xs text-surface-600 text-center">
            Debate opened {formatDate(createdAt)}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <ShareButton statement={statement} topicId={topicId} />

            <Link
              href={`/topic/${topicId}`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-for-500/10 hover:bg-for-500/20 text-for-400 border border-for-500/20 transition-all duration-200"
            >
              <ExternalLink className="w-4 h-4" />
              Join the debate
            </Link>

            <Link
              href={`/topic/${topicId}/vote-trend`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-surface-200 hover:bg-surface-300 text-surface-900 border border-surface-300/50 transition-all duration-200"
            >
              Consensus trend →
            </Link>
          </div>

          {/* Copy link hint */}
          <div className="bg-surface-100 border border-surface-300/30 rounded-xl p-3 flex items-center gap-2">
            <Copy className="w-3.5 h-3.5 text-surface-600 shrink-0" />
            <span className="text-xs text-surface-600 break-all">
              {typeof window !== 'undefined' ? window.location.origin : 'https://lobby.market'}
              /topic/{topicId}/snapshot
            </span>
          </div>
        </motion.div>
      </main>

      <BottomNav />
    </div>
  )
}
