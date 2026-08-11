'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle2,
  Gavel,
  Loader2,
  MessageSquarePlus,
  ThumbsDown,
  ThumbsUp,
  Vote,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import type { ArgueVote } from '@/app/api/argue/route'

// ─── Category colour map ──────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics: 'text-gold border-gold/30 bg-gold/10',
  Politics: 'text-for-400 border-for-500/30 bg-for-500/10',
  Technology: 'text-purple border-purple/30 bg-purple/10',
  Science: 'text-emerald border-emerald/30 bg-emerald/10',
  Ethics: 'text-against-400 border-against-500/30 bg-against-500/10',
  Philosophy: 'text-surface-400 border-surface-400/30 bg-surface-400/10',
  Culture: 'text-gold border-gold/30 bg-gold/10',
  Health: 'text-emerald border-emerald/30 bg-emerald/10',
  Environment: 'text-emerald border-emerald/30 bg-emerald/10',
  Education: 'text-purple border-purple/30 bg-purple/10',
}

function catClass(category: string | null): string {
  return category
    ? (CAT_COLOR[category] ?? 'text-surface-500 border-surface-500/30 bg-surface-500/10')
    : 'text-surface-500 border-surface-500/30 bg-surface-500/10'
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

// ─── Vote card ────────────────────────────────────────────────────────────────

function VoteCard({ vote, index }: { vote: ArgueVote; index: number }) {
  const isFor = vote.side === 'blue'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
    >
      <Link
        href={`/write?topic=${vote.topic_id}&side=${vote.side}`}
        className={cn(
          'group flex gap-4 p-4 rounded-xl',
          'bg-surface-100 border border-surface-300',
          'hover:border-surface-400 active:scale-[0.985]',
          'transition-all duration-150',
        )}
      >
        {/* Side indicator */}
        <div
          className={cn(
            'flex items-center justify-center h-10 w-10 rounded-xl flex-shrink-0 border',
            isFor
              ? 'bg-for-500/10 border-for-500/30'
              : 'bg-against-500/10 border-against-500/30',
          )}
        >
          {isFor ? (
            <ThumbsUp className="h-5 w-5 text-for-400" aria-hidden="true" />
          ) : (
            <ThumbsDown className="h-5 w-5 text-against-400" aria-hidden="true" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
            {vote.topic_statement}
          </p>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {/* Side badge */}
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border',
                isFor
                  ? 'text-for-400 border-for-500/30 bg-for-500/10'
                  : 'text-against-400 border-against-500/30 bg-against-500/10',
              )}
            >
              {isFor ? 'FOR' : 'AGAINST'}
            </span>

            {/* Category */}
            {vote.topic_category && (
              <span
                className={cn(
                  'inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded border',
                  catClass(vote.topic_category),
                )}
              >
                {vote.topic_category}
              </span>
            )}

            {/* Vote count */}
            {vote.total_votes > 0 && (
              <span className="text-[10px] font-mono text-surface-500">
                {vote.total_votes.toLocaleString()} votes
              </span>
            )}

            {/* Time */}
            <span className="text-[10px] font-mono text-surface-600 ml-auto">
              {relativeTime(vote.voted_at)}
            </span>
          </div>

          {/* Vote split bar */}
          {vote.total_votes > 0 && (
            <div className="mt-2 flex gap-px h-1 rounded-full overflow-hidden">
              <div
                className="bg-for-500 transition-all"
                style={{ width: `${vote.blue_pct}%` }}
              />
              <div
                className="bg-against-500 transition-all"
                style={{ width: `${100 - vote.blue_pct}%` }}
              />
            </div>
          )}
        </div>

        {/* Arrow */}
        <div className="flex items-center flex-shrink-0">
          <ArrowRight
            className="h-4 w-4 text-surface-500 group-hover:text-surface-300 group-hover:translate-x-0.5 transition-all"
            aria-hidden="true"
          />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ hasVotes }: { hasVotes: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center text-center py-16 px-6"
    >
      <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-for-500/10 border border-for-500/20 mb-4">
        <CheckCircle2 className="h-8 w-8 text-for-400" aria-hidden="true" />
      </div>
      {hasVotes ? (
        <>
          <h2 className="text-lg font-bold text-white font-mono mb-2">
            You&apos;ve argued every vote
          </h2>
          <p className="text-sm text-surface-500 max-w-xs mb-6">
            Every position you&apos;ve taken has a written argument behind it. Keep it up.
          </p>
          <Link
            href="/swipe"
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl',
              'bg-for-500/10 border border-for-500/30',
              'text-sm font-mono font-semibold text-for-400',
              'hover:bg-for-500/20 transition-colors',
            )}
          >
            <Vote className="h-4 w-4" aria-hidden="true" />
            Vote on more topics
          </Link>
        </>
      ) : (
        <>
          <h2 className="text-lg font-bold text-white font-mono mb-2">
            No votes yet
          </h2>
          <p className="text-sm text-surface-500 max-w-xs mb-6">
            Start voting on topics and this page will show you where to put your argument.
          </p>
          <Link
            href="/swipe"
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl',
              'bg-for-500/10 border border-for-500/30',
              'text-sm font-mono font-semibold text-for-400',
              'hover:bg-for-500/20 transition-colors',
            )}
          >
            <Vote className="h-4 w-4" aria-hidden="true" />
            Vote on topics
          </Link>
        </>
      )}
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ArgueClient() {
  const [votes, setVotes] = useState<ArgueVote[]>([])
  const [totalVoted, setTotalVoted] = useState(0)
  const [totalArgued, setTotalArgued] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/argue')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      })
      .then((data) => {
        setVotes(data.votes ?? [])
        setTotalVoted(data.total_voted ?? 0)
        setTotalArgued(data.total_argued ?? 0)
      })
      .catch(() => setError('Could not load your votes.'))
      .finally(() => setLoading(false))
  }, [])

  const arguedPct =
    totalVoted > 0 ? Math.round((totalArgued / totalVoted) * 100) : 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-xl mx-auto px-4 pt-6 pb-24 md:pb-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0">
            <MessageSquarePlus className="h-5 w-5 text-emerald" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white">
              Back Your Vote
            </h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              {loading
                ? 'Loading your votes…'
                : votes.length > 0
                ? `${votes.length} vote${votes.length !== 1 ? 's' : ''} waiting for an argument`
                : 'Nothing left to argue'}
            </p>
          </div>

          {/* Quick link to write composer */}
          <Link
            href="/write"
            className="ml-auto flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-mono font-medium text-surface-400 hover:text-white hover:bg-surface-200 transition-colors flex-shrink-0"
          >
            <Gavel className="h-3.5 w-3.5" aria-hidden="true" />
            Compose
          </Link>
        </div>

        {/* Progress bar (shown once data is loaded and user has votes) */}
        <AnimatePresence>
          {!loading && totalVoted > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-5 p-4 rounded-xl bg-surface-100 border border-surface-300"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-surface-400">
                  Arguments written
                </span>
                <span className="text-xs font-mono font-bold text-white">
                  {totalArgued} / {totalVoted}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-emerald to-for-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${arguedPct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                />
              </div>
              <p className="text-[10px] font-mono text-surface-600 mt-1.5">
                {arguedPct}% of your votes backed with a reason
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 text-surface-500 animate-spin" aria-label="Loading" />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-sm text-surface-500 font-mono">{error}</p>
          </div>
        ) : votes.length === 0 ? (
          <EmptyState hasVotes={totalVoted > 0} />
        ) : (
          <div className="space-y-2">
            {votes.map((vote, i) => (
              <VoteCard key={vote.vote_id} vote={vote} index={i} />
            ))}

            {/* Bottom CTA */}
            <div className="pt-4 text-center">
              <Link
                href="/write"
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl',
                  'bg-emerald/10 border border-emerald/30',
                  'text-sm font-mono font-semibold text-emerald',
                  'hover:bg-emerald/20 transition-colors',
                )}
              >
                <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
                Argue any topic
              </Link>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
