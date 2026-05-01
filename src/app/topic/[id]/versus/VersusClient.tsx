'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ExternalLink,
  MessageSquare,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Zap,
  Trophy,
  Scale,
  Users,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import type { VersusData, VersusArgument } from './page'

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

// ─── Argument card ─────────────────────────────────────────────────────────────

interface ArgCardProps {
  arg: VersusArgument
  side: 'for' | 'against'
  topicId: string
  currentUserId: string | null
  isLeading: boolean
  onUpvote: (id: string) => void
  upvoteCount: number
  hasUpvoted: boolean
}

function ArgCard({
  arg,
  side,
  topicId,
  currentUserId,
  isLeading,
  onUpvote,
  upvoteCount,
  hasUpvoted,
}: ArgCardProps) {
  const isFor = side === 'for'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: isFor ? 0 : 0.1 }}
      className={cn(
        'relative flex flex-col h-full rounded-2xl border overflow-hidden',
        'bg-surface-100',
        isFor
          ? 'border-for-500/30'
          : 'border-against-500/30'
      )}
    >
      {/* Side header */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-3 border-b',
          isFor
            ? 'bg-for-500/10 border-for-500/20'
            : 'bg-against-500/10 border-against-500/20'
        )}
      >
        <div className="flex items-center gap-2">
          {isFor
            ? <ThumbsUp className="h-4 w-4 text-for-400" />
            : <ThumbsDown className="h-4 w-4 text-against-400" />
          }
          <span
            className={cn(
              'text-sm font-mono font-bold tracking-wider uppercase',
              isFor ? 'text-for-400' : 'text-against-400'
            )}
          >
            {isFor ? 'For' : 'Against'}
          </span>
          {isLeading && (
            <span
              className={cn(
                'flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded',
                isFor
                  ? 'bg-for-500/20 text-for-300'
                  : 'bg-against-500/20 text-against-300'
              )}
            >
              <Trophy className="h-2.5 w-2.5" />
              Leading
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs font-mono text-surface-500">
          <ThumbsUp className="h-3 w-3" />
          <span>{upvoteCount}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-5 flex flex-col gap-4">
        {/* Author */}
        {arg.author && (
          <Link
            href={`/profile/${arg.author.username}`}
            className="flex items-center gap-2.5 group w-fit"
          >
            <Avatar
              src={arg.author.avatar_url}
              fallback={arg.author.display_name ?? arg.author.username}
              size="sm"
            />
            <div>
              <p className="text-sm font-semibold text-white group-hover:text-for-300 transition-colors">
                {arg.author.display_name ?? arg.author.username}
              </p>
              <p className="text-[11px] font-mono text-surface-500">
                @{arg.author.username} · {relativeTime(arg.created_at)}
              </p>
            </div>
          </Link>
        )}

        {/* Argument text */}
        <blockquote
          className={cn(
            'text-base leading-relaxed font-mono flex-1',
            'border-l-2 pl-4',
            isFor ? 'border-for-500/50 text-for-100' : 'border-against-500/50 text-against-100'
          )}
        >
          {arg.content}
        </blockquote>

        {/* Source link */}
        {arg.source_url && (
          <a
            href={arg.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors w-fit"
          >
            <ExternalLink className="h-3 w-3" />
            Source
          </a>
        )}
      </div>

      {/* Footer: actions */}
      <div
        className={cn(
          'px-4 py-3 border-t flex items-center justify-between',
          isFor ? 'border-for-500/20' : 'border-against-500/20'
        )}
      >
        {/* Upvote */}
        <button
          onClick={() => onUpvote(arg.id)}
          disabled={!currentUserId || hasUpvoted}
          className={cn(
            'flex items-center gap-1.5 text-sm font-mono font-semibold px-3 py-1.5 rounded-lg transition-all',
            hasUpvoted
              ? isFor
                ? 'bg-for-500/20 text-for-300 cursor-default'
                : 'bg-against-500/20 text-against-300 cursor-default'
              : !currentUserId
              ? 'text-surface-500 cursor-not-allowed'
              : isFor
              ? 'text-surface-400 hover:text-for-300 hover:bg-for-500/10'
              : 'text-surface-400 hover:text-against-300 hover:bg-against-500/10'
          )}
          aria-label={hasUpvoted ? 'Upvoted' : 'Upvote this argument'}
        >
          <ThumbsUp className="h-4 w-4" />
          {hasUpvoted ? 'Upvoted' : 'Upvote'}
        </button>

        {/* View full argument */}
        <Link
          href={`/topic/${topicId}?tab=arguments`}
          className={cn(
            'flex items-center gap-1 text-xs font-mono transition-colors',
            isFor
              ? 'text-surface-500 hover:text-for-400'
              : 'text-surface-500 hover:text-against-400'
          )}
        >
          <MessageSquare className="h-3 w-3" />
          Full thread
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Empty side placeholder ────────────────────────────────────────────────────

function EmptySide({ side, topicId }: { side: 'for' | 'against'; topicId: string }) {
  const isFor = side === 'for'
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center h-full rounded-2xl border border-dashed p-8 text-center gap-4',
        isFor ? 'border-for-500/20' : 'border-against-500/20'
      )}
    >
      {isFor
        ? <ThumbsUp className="h-8 w-8 text-for-500/40" />
        : <ThumbsDown className="h-8 w-8 text-against-500/40" />
      }
      <div>
        <p className="text-sm font-semibold text-surface-400">
          No {isFor ? 'FOR' : 'AGAINST'} argument yet
        </p>
        <p className="text-xs text-surface-600 mt-1">
          Be the first to make the case
        </p>
      </div>
      <Link
        href={`/topic/${topicId}?tab=arguments`}
        className={cn(
          'text-xs font-mono px-3 py-1.5 rounded-lg transition-colors',
          isFor
            ? 'bg-for-500/10 text-for-400 hover:bg-for-500/20'
            : 'bg-against-500/10 text-against-400 hover:bg-against-500/20'
        )}
      >
        Write argument →
      </Link>
    </div>
  )
}

// ─── Vote split bar ────────────────────────────────────────────────────────────

function VoteSplitBar({ bluePct }: { bluePct: number }) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs font-mono mb-1.5">
        <span className="text-for-400 font-bold">{forPct}% For</span>
        <span className="text-against-400 font-bold">{againstPct}% Against</span>
      </div>
      <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-for-500 to-for-400"
          initial={{ width: '50%' }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
        />
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function VersusClient({ data }: { data: VersusData }) {
  const { topic, forArg, againstArg, totalArguments, currentUserId } = data

  const [forUpvotes, setForUpvotes] = useState(forArg?.upvotes ?? 0)
  const [againstUpvotes, setAgainstUpvotes] = useState(againstArg?.upvotes ?? 0)
  const [upvotedFor, setUpvotedFor] = useState(false)
  const [upvotedAgainst, setUpvotedAgainst] = useState(false)
  const [shareMsg, setShareMsg] = useState<string | null>(null)

  const forPct = Math.round(topic.blue_pct ?? 50)
  const isForLeading = forPct >= 50

  const handleUpvote = useCallback(async (argId: string, side: 'for' | 'against') => {
    if (!currentUserId) return
    const alreadyVoted = side === 'for' ? upvotedFor : upvotedAgainst
    if (alreadyVoted) return

    if (side === 'for') setUpvotedFor(true)
    else setUpvotedAgainst(true)

    try {
      const supabase = createClient()
      await supabase.from('topic_argument_votes').upsert({
        argument_id: argId,
        user_id: currentUserId,
      })
      // Optimistically increment
      if (side === 'for') setForUpvotes((n) => n + 1)
      else setAgainstUpvotes((n) => n + 1)
    } catch {
      // Revert on failure
      if (side === 'for') setUpvotedFor(false)
      else setUpvotedAgainst(false)
    }
  }, [currentUserId, upvotedFor, upvotedAgainst])

  const handleShare = useCallback(() => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const text = `FOR vs AGAINST: "${topic.statement}" — see both sides on Lobby Market`
    if (navigator.share) {
      navigator.share({ title: 'Lobby Market — Argument Face-Off', text, url }).catch(() => null)
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setShareMsg('Link copied!')
        setTimeout(() => setShareMsg(null), 2000)
      })
    }
  }, [topic.statement])

  const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
    proposed: 'proposed',
    active: 'active',
    voting: 'active',
    law: 'law',
    failed: 'failed',
  }

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-surface-100/90 backdrop-blur border-b border-surface-300">
        <div className="max-w-5xl mx-auto flex items-center justify-between h-14 px-4 gap-3">
          <Link
            href={`/topic/${topic.id}`}
            className="flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Topic
          </Link>

          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-surface-500" />
            <span className="text-sm font-mono text-surface-400 hidden sm:block">
              Argument Face-Off
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/topic/${topic.id}?tab=arguments`}
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:block">{totalArguments} arguments</span>
            </Link>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-surface-200"
              aria-label="Share this face-off"
            >
              <Share2 className="h-3.5 w-3.5" />
              <AnimatePresence mode="wait">
                {shareMsg ? (
                  <motion.span
                    key="copied"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-emerald"
                  >
                    {shareMsg}
                  </motion.span>
                ) : (
                  <motion.span key="share" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    Share
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </header>

      {/* ── Topic hero ──────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto w-full px-4 pt-8 pb-6"
      >
        <div className="flex flex-col items-center text-center gap-4">
          {/* Category + status */}
          <div className="flex items-center gap-2">
            {topic.category && (
              <Badge variant="proposed">
                {topic.category}
              </Badge>
            )}
            <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
              {topic.status.charAt(0).toUpperCase() + topic.status.slice(1)}
            </Badge>
          </div>

          {/* Statement */}
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold font-mono text-white leading-tight max-w-3xl">
            {topic.statement}
          </h1>

          {/* VS badge */}
          <div className="flex items-center gap-3 my-1">
            <span className="text-xs font-mono text-for-400 font-bold tracking-widest uppercase">
              For
            </span>
            <div className="flex items-center justify-center h-9 w-9 rounded-full bg-surface-200 border border-surface-400">
              <span className="text-xs font-mono font-black text-white">VS</span>
            </div>
            <span className="text-xs font-mono text-against-400 font-bold tracking-widest uppercase">
              Against
            </span>
          </div>

          {/* Vote split */}
          <div className="w-full max-w-sm">
            <VoteSplitBar bluePct={topic.blue_pct ?? 50} />
          </div>

          {/* Vote count */}
          <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
            <Users className="h-3.5 w-3.5" />
            <span>{(topic.total_votes ?? 0).toLocaleString()} votes cast</span>
          </div>
        </div>
      </motion.div>

      {/* ── Arguments split ──────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 h-full">
          {/* FOR side */}
          {forArg ? (
            <ArgCard
              arg={forArg}
              side="for"
              topicId={topic.id}
              currentUserId={currentUserId}
              isLeading={isForLeading}
              onUpvote={(id) => handleUpvote(id, 'for')}
              upvoteCount={forUpvotes}
              hasUpvoted={upvotedFor}
            />
          ) : (
            <EmptySide side="for" topicId={topic.id} />
          )}

          {/* AGAINST side */}
          {againstArg ? (
            <ArgCard
              arg={againstArg}
              side="against"
              topicId={topic.id}
              currentUserId={currentUserId}
              isLeading={!isForLeading}
              onUpvote={(id) => handleUpvote(id, 'against')}
              upvoteCount={againstUpvotes}
              hasUpvoted={upvotedAgainst}
            />
          ) : (
            <EmptySide side="against" topicId={topic.id} />
          )}
        </div>

        {/* ── Bottom CTAs ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Link
            href={`/topic/${topic.id}`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-400 text-sm font-mono text-surface-300 hover:text-white hover:border-surface-500 transition-all"
          >
            <BarChart2 className="h-4 w-4" />
            Full topic stats
          </Link>
          <Link
            href={`/topic/${topic.id}?tab=arguments`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-for-500/10 border border-for-500/30 text-sm font-mono text-for-300 hover:bg-for-500/20 transition-all"
          >
            <MessageSquare className="h-4 w-4" />
            All arguments
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href={`/topic/${topic.id}/argument-graph`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple/10 border border-purple/30 text-sm font-mono text-purple hover:bg-purple/20 transition-all"
          >
            <Zap className="h-4 w-4" />
            Argument graph
          </Link>
        </motion.div>
      </main>
    </div>
  )
}
