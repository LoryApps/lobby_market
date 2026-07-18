'use client'

/**
 * /exchange/ideas/[id] — Market Idea Detail
 *
 * Full view of a single market thesis:
 *   - Direction (FOR / AGAINST / NEUTRAL) with visual treatment
 *   - Target price vs current market price
 *   - Confidence rating
 *   - Author card with prediction track record
 *   - Up/down voting
 *   - Related ideas on the same topic
 *   - More from the same author
 *
 * Distinct from /exchange/ideas (list feed) and /exchange/[id] (market detail).
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart2,
  Brain,
  ChevronRight,
  Coins,
  ExternalLink,
  Flame,
  Loader2,
  Scale,
  Star,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { SharePanel } from '@/components/ui/SharePanel'
import { cn } from '@/lib/utils/cn'
import type { IdeaDetailResponse } from '@/app/api/exchange/ideas/[id]/route'
import type { MarketIdea } from '@/app/api/exchange/ideas/route'

// ─── Direction config ─────────────────────────────────────────────────────────

const DIR_CONFIG = {
  for: {
    label: 'FOR',
    Icon: TrendingUp,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    badge: 'bg-for-600/20 text-for-300 border-for-500/40',
    pill: 'bg-for-500',
  },
  against: {
    label: 'AGAINST',
    Icon: TrendingDown,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    badge: 'bg-against-600/20 text-against-300 border-against-500/40',
    pill: 'bg-against-500',
  },
  neutral: {
    label: 'NEUTRAL',
    Icon: Scale,
    color: 'text-surface-400',
    bg: 'bg-surface-300/20',
    border: 'border-surface-400/30',
    badge: 'bg-surface-300/20 text-surface-300 border-surface-400/30',
    pill: 'bg-surface-500',
  },
} as const

const CONFIDENCE_LABELS = ['', 'Low', 'Moderate', 'Confident', 'High', 'Conviction']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const ms   = Date.now() - new Date(iso).getTime()
  const m    = Math.floor(ms / 60_000)
  const h    = Math.floor(m / 60)
  const d    = Math.floor(h / 24)
  if (m < 2)  return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7)  return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function priceDiff(current: number, target: number): { diff: number; pct: number } {
  const diff = target - current
  const pct  = current === 0 ? 0 : Math.round(Math.abs(diff / current) * 100)
  return { diff, pct }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConfidenceStars({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            i < level ? 'text-gold fill-gold' : 'text-surface-500',
          )}
        />
      ))}
    </div>
  )
}

function IdeaCard({
  idea,
  compact = false,
}: {
  idea: MarketIdea
  compact?: boolean
}) {
  const dir = DIR_CONFIG[idea.direction] ?? DIR_CONFIG.neutral
  const DirIcon = dir.Icon
  const topicPrice = Math.round(idea.topic?.blue_pct ?? 50)

  return (
    <Link
      href={`/exchange/ideas/${idea.id}`}
      className={cn(
        'group flex gap-3 rounded-xl border bg-surface-100',
        'hover:border-surface-400/60 transition-colors',
        dir.border,
        compact ? 'p-3' : 'p-4',
      )}
    >
      <div
        className={cn(
          'flex-shrink-0 flex items-center justify-center rounded-lg mt-0.5',
          dir.bg,
          compact ? 'h-7 w-7' : 'h-8 w-8',
        )}
      >
        <DirIcon className={cn('h-4 w-4', dir.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          'font-semibold text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors',
          compact ? 'text-xs' : 'text-sm',
        )}>
          {idea.title}
        </p>
        {!compact && (
          <p className="text-xs text-surface-500 line-clamp-2 mt-0.5 leading-relaxed">
            {idea.body}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className={cn('text-[10px] font-mono font-bold uppercase tracking-wider', dir.color)}>
            {dir.label}
          </span>
          {idea.target_price != null && (
            <span className="text-[10px] font-mono text-surface-500">
              Target {idea.target_price}¢ · Now {topicPrice}¢
            </span>
          )}
          <span className="text-[10px] font-mono text-surface-600">
            {(idea.upvotes - idea.downvotes) > 0 ? '+' : ''}{idea.upvotes - idea.downvotes} pts
          </span>
        </div>
      </div>
      <ChevronRight className="flex-shrink-0 h-4 w-4 text-surface-600 group-hover:text-surface-400 transition-colors self-center" />
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface IdeaDetailClientProps {
  id: string
}

export function IdeaDetailClient({ id }: IdeaDetailClientProps) {
  const router = useRouter()
  const [data, setData]               = useState<IdeaDetailResponse | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [voting, setVoting]           = useState(false)
  const [viewerVote, setViewerVote]   = useState<'up' | 'down' | null>(null)
  const [upvotes, setUpvotes]         = useState(0)
  const [downvotes, setDownvotes]     = useState(0)
  // share managed by SharePanel itself

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/exchange/ideas/${id}`)
      if (res.status === 404) { router.replace('/exchange/ideas'); return }
      if (!res.ok) throw new Error('Failed to load')
      const json: IdeaDetailResponse = await res.json()
      setData(json)
      setViewerVote(json.idea.viewer_vote)
      setUpvotes(json.idea.upvotes)
      setDownvotes(json.idea.downvotes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { load() }, [load])

  async function handleVote(direction: 'up' | 'down') {
    if (voting) return
    setVoting(true)

    const prev = viewerVote
    const newDir = prev === direction ? null : direction

    // Optimistic update
    setViewerVote(newDir)
    if (prev === 'up')           setUpvotes(v => Math.max(0, v - 1))
    if (prev === 'down')         setDownvotes(v => Math.max(0, v - 1))
    if (newDir === 'up')         setUpvotes(v => v + 1)
    if (newDir === 'down')       setDownvotes(v => v + 1)

    try {
      const res = await fetch('/api/exchange/ideas/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea_id: id, direction: newDir }),
      })
      if (!res.ok) throw new Error('Vote failed')
      const json = await res.json()
      setUpvotes(json.upvotes)
      setDownvotes(json.downvotes)
      setViewerVote(json.viewer_vote)
    } catch {
      // Revert
      setViewerVote(prev)
      if (newDir === 'up')         setUpvotes(v => Math.max(0, v - 1))
      if (newDir === 'down')       setDownvotes(v => Math.max(0, v - 1))
      if (prev === 'up')           setUpvotes(v => v + 1)
      if (prev === 'down')         setDownvotes(v => v + 1)
    } finally {
      setVoting(false)
    }
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12 space-y-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-4/5" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </main>
        <BottomNav />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
          <div className="rounded-2xl border border-against-500/30 bg-against-500/5 p-8 text-center">
            <p className="text-against-400 font-mono text-sm mb-4">{error ?? 'Idea not found'}</p>
            <Link href="/exchange/ideas" className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors">
              ← Back to ideas
            </Link>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  const { idea, related_topic_ideas, related_author_ideas } = data
  const dir         = DIR_CONFIG[idea.direction] ?? DIR_CONFIG.neutral
  const DirIcon     = dir.Icon
  const topicPrice  = idea.topic ? Math.round(idea.topic.blue_pct ?? 50) : null
  const score       = upvotes - downvotes
  const pageUrl     = typeof window !== 'undefined' ? window.location.href : `/exchange/ideas/${id}`
  const hasTarget   = idea.target_price != null
  const priceGap    = hasTarget && topicPrice != null
    ? priceDiff(topicPrice, idea.target_price!)
    : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12 space-y-5">

        {/* ── Back nav ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <Link
            href="/exchange/ideas"
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Market Ideas
          </Link>
          <span className="text-surface-700 text-xs">·</span>
          {idea.topic && (
            <Link
              href={`/exchange/${idea.topic.id}`}
              className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors truncate"
            >
              <BarChart2 className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{idea.topic.statement.slice(0, 40)}{idea.topic.statement.length > 40 ? '…' : ''}</span>
              <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />
            </Link>
          )}
        </div>

        {/* ── Hero card ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'rounded-2xl border-2 bg-surface-100 p-5',
            dir.border,
          )}
        >
          {/* Direction + featured badge */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-bold uppercase tracking-wider',
                dir.badge,
              )}
            >
              <DirIcon className="h-3.5 w-3.5" />
              {dir.label}
            </span>
            {idea.is_featured && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-gold/40 bg-gold/10 text-gold text-[10px] font-mono font-bold uppercase tracking-wider">
                <Star className="h-3 w-3" />
                Featured
              </span>
            )}
            <span className="ml-auto text-[11px] font-mono text-surface-500">
              {timeAgo(idea.created_at)}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-lg font-bold text-white leading-snug mb-3">
            {idea.title}
          </h1>

          {/* Body */}
          <p className="text-sm text-surface-400 leading-relaxed mb-4 font-mono">
            {idea.body}
          </p>

          {/* Price + Confidence row */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* Target vs Current */}
            {hasTarget && topicPrice != null ? (
              <div className={cn(
                'rounded-xl p-3 border',
                dir.bg, dir.border,
              )}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Target className={cn('h-3.5 w-3.5', dir.color)} />
                  <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Price Target</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className={cn('text-xl font-mono font-bold', dir.color)}>
                    {idea.target_price}¢
                  </span>
                  <span className="text-xs font-mono text-surface-500 mb-0.5">
                    now {topicPrice}¢
                  </span>
                </div>
                {priceGap && (
                  <p className={cn(
                    'text-[10px] font-mono mt-1',
                    priceGap.diff > 0 ? 'text-for-400' : priceGap.diff < 0 ? 'text-against-400' : 'text-surface-500',
                  )}>
                    {priceGap.diff > 0 ? `+${priceGap.diff}¢ to target` : priceGap.diff < 0 ? `${priceGap.diff}¢ to target` : 'At target'}
                    {priceGap.pct > 0 && ` (${priceGap.pct}%)`}
                  </p>
                )}
              </div>
            ) : topicPrice != null ? (
              <div className="rounded-xl p-3 border border-surface-300 bg-surface-200/40">
                <div className="flex items-center gap-1.5 mb-1">
                  <BarChart2 className="h-3.5 w-3.5 text-for-400" />
                  <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Current Price</span>
                </div>
                <span className="text-xl font-mono font-bold text-white">{topicPrice}¢</span>
                <p className="text-[10px] font-mono text-surface-600 mt-1">No target set</p>
              </div>
            ) : null}

            {/* Confidence */}
            <div className="rounded-xl p-3 border border-surface-300 bg-surface-200/40">
              <div className="flex items-center gap-1.5 mb-1">
                <Brain className="h-3.5 w-3.5 text-purple" />
                <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Confidence</span>
              </div>
              <div className="flex items-center gap-2">
                <ConfidenceStars level={idea.confidence} />
              </div>
              <p className="text-[10px] font-mono text-surface-500 mt-1">
                {CONFIDENCE_LABELS[idea.confidence] ?? 'Unknown'}
              </p>
            </div>
          </div>

          {/* Voting + share row */}
          <div className="flex items-center gap-3 pt-3 border-t border-surface-300">
            {/* Up */}
            <button
              onClick={() => handleVote('up')}
              disabled={voting}
              aria-label="Upvote this idea"
              className={cn(
                'flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-mono font-semibold transition-all',
                viewerVote === 'up'
                  ? 'bg-for-500/20 border-for-500/50 text-for-300'
                  : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-for-500/40 hover:text-for-400',
                voting && 'opacity-50 cursor-not-allowed',
              )}
            >
              {voting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ThumbsUp className="h-3.5 w-3.5" />
              )}
              <span>{upvotes}</span>
            </button>

            {/* Down */}
            <button
              onClick={() => handleVote('down')}
              disabled={voting}
              aria-label="Downvote this idea"
              className={cn(
                'flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-mono font-semibold transition-all',
                viewerVote === 'down'
                  ? 'bg-against-500/20 border-against-500/50 text-against-300'
                  : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-against-500/40 hover:text-against-400',
                voting && 'opacity-50 cursor-not-allowed',
              )}
            >
              {voting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ThumbsDown className="h-3.5 w-3.5" />
              )}
              <span>{downvotes}</span>
            </button>

            <div className="flex-1" />

            {/* Net score */}
            <span className={cn(
              'text-xs font-mono font-bold',
              score > 0 ? 'text-for-400' : score < 0 ? 'text-against-400' : 'text-surface-500',
            )}>
              {score > 0 ? '+' : ''}{score} pts
            </span>

            {/* Share */}
            <SharePanel
              url={pageUrl}
              text={`${idea.title} — Market thesis on Lobby Exchange`}
            />

            {/* View market */}
            {idea.topic && (
              <Link
                href={`/exchange/${idea.topic.id}`}
                className="flex items-center gap-1 h-8 px-3 rounded-lg border border-for-500/30 bg-for-500/10 text-for-300 hover:bg-for-500/20 text-xs font-mono transition-colors"
              >
                View Market
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </motion.div>

        {/* ── Author card ────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-surface-300 bg-surface-100 p-4"
        >
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3">
            Thesis Author
          </p>
          <Link href={`/profile/${idea.author.username}`} className="group flex items-center gap-3">
            <Avatar
              src={idea.author.avatar_url}
              fallback={idea.author.display_name || idea.author.username}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white group-hover:text-for-300 transition-colors">
                {idea.author.display_name || idea.author.username}
              </p>
              <p className="text-xs font-mono text-surface-500">@{idea.author.username}</p>
              <p className="text-[10px] font-mono text-surface-600 capitalize mt-0.5">
                {idea.author.role.replace('_', ' ')}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 transition-colors" />
          </Link>

          {/* Author stats */}
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-surface-300">
            <div className="flex flex-col items-center gap-0.5 p-2 rounded-lg bg-surface-200/50">
              <Coins className="h-3.5 w-3.5 text-gold" />
              <span className="text-xs font-mono font-bold text-white">
                {idea.author.clout.toLocaleString()}
              </span>
              <span className="text-[9px] font-mono text-surface-600">CLOUT</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 p-2 rounded-lg bg-surface-200/50">
              <Zap className="h-3.5 w-3.5 text-purple" />
              <span className="text-xs font-mono font-bold text-white">
                {idea.author_ideas_count}
              </span>
              <span className="text-[9px] font-mono text-surface-600">IDEAS</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 p-2 rounded-lg bg-surface-200/50">
              <Flame className={cn('h-3.5 w-3.5', idea.author_avg_score >= 0 ? 'text-for-400' : 'text-against-400')} />
              <span className={cn(
                'text-xs font-mono font-bold',
                idea.author_avg_score > 0 ? 'text-for-300' : idea.author_avg_score < 0 ? 'text-against-300' : 'text-white',
              )}>
                {idea.author_avg_score > 0 ? '+' : ''}{idea.author_avg_score}
              </span>
              <span className="text-[9px] font-mono text-surface-600">AVG PTS</span>
            </div>
          </div>
        </motion.div>

        {/* ── Topic context ─────────────────────────────────────────────── */}
        {idea.topic && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
          >
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-2 px-1">
              Thesis Market
            </p>
            <Link
              href={`/exchange/${idea.topic.id}`}
              className="group flex items-start gap-3 rounded-xl border border-surface-300 bg-surface-100 p-4 hover:border-for-500/30 transition-colors"
            >
              <div className="flex-shrink-0 h-9 w-9 rounded-xl bg-for-500/10 border border-for-500/20 flex items-center justify-center mt-0.5">
                <BarChart2 className="h-4 w-4 text-for-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
                  {idea.topic.statement}
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {idea.topic.category && (
                    <span className="text-[10px] font-mono text-surface-500">{idea.topic.category}</span>
                  )}
                  <Badge
                    variant={
                      idea.topic.status === 'law' ? 'law'
                      : idea.topic.status === 'active' || idea.topic.status === 'voting' ? 'active'
                      : 'proposed'
                    }
                  >
                    {idea.topic.status.toUpperCase()}
                  </Badge>
                  <span className="text-[10px] font-mono text-for-400">
                    {Math.round(idea.topic.blue_pct ?? 50)}¢ FOR
                  </span>
                </div>
                {/* Mini vote bar */}
                <div className="mt-2 h-1.5 rounded-full bg-surface-300 overflow-hidden">
                  <div
                    className="h-full bg-for-500 rounded-full"
                    style={{ width: `${Math.round(idea.topic.blue_pct ?? 50)}%` }}
                  />
                </div>
              </div>
              <ArrowUpRight className="flex-shrink-0 h-4 w-4 text-surface-600 group-hover:text-for-400 transition-colors mt-0.5" />
            </Link>
          </motion.div>
        )}

        {/* ── Related ideas on same topic ───────────────────────────────── */}
        <AnimatePresence>
          {related_topic_ideas.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
            >
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">
                  More Theses on This Market
                </p>
                {idea.topic && (
                  <Link
                    href={`/exchange/ideas?topic_id=${idea.topic_id}`}
                    className="text-[10px] font-mono text-for-400 hover:text-for-300 transition-colors"
                  >
                    See all →
                  </Link>
                )}
              </div>
              <div className="space-y-2">
                {related_topic_ideas.map((rel) => (
                  <IdeaCard key={rel.id} idea={rel} compact />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── More from this author ─────────────────────────────────────── */}
        <AnimatePresence>
          {related_author_ideas.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">
                  More from @{idea.author.username}
                </p>
              </div>
              <div className="space-y-2">
                {related_author_ideas.map((rel) => (
                  <IdeaCard key={rel.id} idea={rel} compact />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Footer CTA ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/exchange/ideas"
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All ideas
          </Link>
          <span className="text-surface-700">·</span>
          <Link
            href="/exchange"
            className="text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
          >
            Exchange →
          </Link>
        </div>

      </main>


      <BottomNav />
    </div>
  )
}
