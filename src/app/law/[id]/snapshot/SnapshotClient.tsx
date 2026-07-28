'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Gavel,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SnapshotArg {
  id: string
  content: string
  upvotes: number
  author_username: string | null
}

interface LawSnapshotClientProps {
  lawId: string
  statement: string
  fullStatement: string
  category: string | null
  forPct: number
  totalVotes: number
  establishedAt: string
  isActive: boolean
  topicId: string | null
  totalArguments: number
  totalAmendments: number
  totalContributors: number
  topForArg: SnapshotArg | null
  topAgainstArg: SnapshotArg | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
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

function ShareButton({ statement, lawId }: { statement: string; lawId: string }) {
  const [copied, setCopied] = useState(false)

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/law/${lawId}/snapshot`
    const shareData = {
      title: `Established Law: ${statement}`,
      text: `This debate reached consensus and became law on Lobby Market: ${statement}`,
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
  }, [statement, lawId])

  return (
    <button
      onClick={handleShare}
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
        copied
          ? 'bg-emerald/20 text-emerald border border-emerald/30'
          : 'bg-surface-200 hover:bg-surface-300 text-white border border-surface-300/50'
      )}
    >
      {copied ? (
        <>
          <Check className="w-4 h-4" />
          Copied link
        </>
      ) : (
        <>
          <Share2 className="w-4 h-4" />
          Share snapshot
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
      <div className="h-3 rounded-full bg-surface-300 overflow-hidden flex">
        <motion.div
          className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-l-full"
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
        <motion.div
          className="h-full bg-gradient-to-l from-against-600 to-against-400 flex-1 rounded-r-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.3 }}
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
  argument: SnapshotArg | null
  side: 'for' | 'against'
}) {
  const isFor = side === 'for'

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
          {isFor ? 'Top FOR argument' : 'Top AGAINST argument'}
        </span>
        {argument && (
          <span className="ml-auto text-xs opacity-70">▲ {formatNum(argument.upvotes)}</span>
        )}
      </div>

      {argument ? (
        <>
          <p className="text-sm text-white leading-relaxed line-clamp-4 flex-1">
            {argument.content}
          </p>
          {argument.author_username && (
            <Link
              href={`/profile/${argument.author_username}`}
              className="text-xs text-surface-500 hover:text-white transition-colors"
            >
              — @{argument.author_username}
            </Link>
          )}
        </>
      ) : (
        <p className="text-sm text-surface-500 italic flex-1">
          No arguments recorded for this side.
        </p>
      )}
    </div>
  )
}

// ─── Stat Tile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="bg-surface-200 border border-surface-300/50 rounded-2xl p-3 text-center">
      {Icon && <Icon className="w-4 h-4 text-surface-500 mx-auto mb-1" />}
      <div className="text-lg font-bold text-white font-mono">{value}</div>
      <div className="text-xs text-surface-500 mt-0.5">{label}</div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LawSnapshotClient({
  lawId,
  statement,
  category,
  forPct,
  totalVotes,
  establishedAt,
  isActive,
  topicId,
  totalArguments,
  totalAmendments,
  totalContributors,
  topForArg,
  topAgainstArg,
}: LawSnapshotClientProps) {
  const snapshotUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/law/${lawId}/snapshot`
      : `https://lobby.market/law/${lawId}/snapshot`

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-10">
        {/* Back nav */}
        <Link
          href={`/law/${lawId}`}
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors mb-5"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to law
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-5"
        >
          {/* Law established banner */}
          <div className="flex items-center gap-3 bg-gold/10 border border-gold/30 rounded-2xl px-4 py-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-gold/20 flex-shrink-0">
              <Gavel className="w-5 h-5 text-gold" />
            </div>
            <div>
              <p className="text-xs font-mono font-bold text-gold uppercase tracking-wider">
                Established Law
              </p>
              <p className="text-xs text-surface-500 mt-0.5">
                Reached consensus on {formatDate(establishedAt)}
              </p>
            </div>
            <div className="ml-auto">
              {isActive ? (
                <span className="flex items-center gap-1 text-xs font-mono text-emerald">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Active
                </span>
              ) : (
                <span className="text-xs font-mono text-surface-500">Inactive</span>
              )}
            </div>
          </div>

          {/* Header */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="law">Law</Badge>
              {category && (
                <span className="text-xs text-surface-500 uppercase tracking-wider font-medium">
                  {category}
                </span>
              )}
              <span className="text-xs text-surface-500 ml-auto font-mono">
                Snapshot
              </span>
            </div>

            <h1 className="text-xl font-bold text-white leading-snug">{statement}</h1>
          </div>

          {/* Vote bar */}
          <div className="bg-surface-100 border border-surface-300/50 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">
              Consensus that passed this into law
            </p>
            <VoteBar forPct={forPct} />
            <p className="text-xs text-surface-500 text-center">
              {formatNum(totalVotes)} votes determined the outcome
            </p>
          </div>

          {/* Top arguments from the original debate */}
          {(topForArg || topAgainstArg) && (
            <div className="space-y-2">
              <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">
                Arguments that shaped the debate
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ArgumentCard argument={topForArg} side="for" />
                <ArgumentCard argument={topAgainstArg} side="against" />
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Arguments" value={formatNum(totalArguments)} />
            <StatTile label="Amendments" value={formatNum(totalAmendments)} />
            <StatTile
              label="Voters"
              value={formatNum(totalContributors)}
              icon={Users}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <ShareButton statement={statement} lawId={lawId} />

            <Link
              href={`/law/${lawId}`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gold/10 hover:bg-gold/20 text-gold border border-gold/20 transition-all duration-200"
            >
              <ExternalLink className="w-4 h-4" />
              Full law
            </Link>

            {topicId && (
              <Link
                href={`/topic/${topicId}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-surface-200 hover:bg-surface-300 text-white border border-surface-300/50 transition-all duration-200"
              >
                Original debate →
              </Link>
            )}
          </div>

          {/* Shareable URL */}
          <div className="bg-surface-100 border border-surface-300/30 rounded-xl p-3 flex items-center gap-2">
            <Copy className="w-3.5 h-3.5 text-surface-500 shrink-0" />
            <span className="text-xs text-surface-500 break-all font-mono">{snapshotUrl}</span>
          </div>

          {/* Related law links */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href={`/law/${lawId}/amendments`}
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm bg-surface-100 border border-surface-300/50 text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            >
              <span>View amendments</span>
              <ArrowLeft className="w-3.5 h-3.5 rotate-180 ml-auto" />
            </Link>
            <Link
              href={`/law/${lawId}/impact`}
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm bg-surface-100 border border-surface-300/50 text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            >
              <span>Impact analysis</span>
              <ArrowLeft className="w-3.5 h-3.5 rotate-180 ml-auto" />
            </Link>
          </div>
        </motion.div>
      </main>

      <BottomNav />
    </div>
  )
}
