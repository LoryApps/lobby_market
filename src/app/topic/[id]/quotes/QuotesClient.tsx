'use client'

/**
 * /topic/[id]/quotes — Best of the Debate
 *
 * A visual gallery of the highest-upvoted community arguments for a topic,
 * presented as shareable quote cards split by FOR / AGAINST side.
 *
 * Distinct from:
 *   /topic/[id]/arguments  — interactive argument thread with replies
 *   /topic/[id]/steelman   — AI-generated best-case for each side
 *   /topic/[id]/synthesis  — AI common-ground synthesis
 *   /top-arguments         — platform-wide argument leaderboard
 *
 * This is the read-only "highlight reel" — the community's own words,
 * ranked by upvotes, displayed as premium quote cards.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  ChevronDown,
  Copy,
  MessageSquare,
  Quote,
  RefreshCw,
  Share2,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { TopicArgumentWithAuthor } from '@/lib/supabase/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuotesClientProps {
  topicId: string
  statement: string
  category: string | null
  status: string
  bluePct: number
  totalVotes: number
}

type SideFilter = 'all' | 'for' | 'against'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function gradeColor(grade: string | null): string {
  if (!grade) return 'text-surface-500'
  const g = grade.toUpperCase()
  if (g === 'A+' || g === 'A') return 'text-emerald'
  if (g === 'A-' || g === 'B+' || g === 'B') return 'text-for-400'
  if (g === 'B-' || g === 'C+' || g === 'C') return 'text-gold'
  return 'text-against-400'
}

// ─── Quote Card ───────────────────────────────────────────────────────────────

function QuoteCard({
  arg,
  rank,
}: {
  arg: TopicArgumentWithAuthor
  rank: number
}) {
  const [copied, setCopied] = useState(false)
  const isFor = arg.side === 'blue'
  const author = arg.author

  function copyQuote() {
    const text = `"${arg.content}" — @${author?.username ?? 'anonymous'} on Lobby Market`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: rank * 0.05 }}
      className={cn(
        'group relative rounded-2xl border p-5 flex flex-col gap-4 transition-shadow hover:shadow-lg',
        isFor
          ? 'bg-for-950/40 border-for-800/40 hover:border-for-700/60'
          : 'bg-against-950/40 border-against-800/40 hover:border-against-700/60'
      )}
    >
      {/* Rank badge */}
      <div className={cn(
        'absolute -top-2.5 -left-2.5 h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold font-mono shadow-md',
        isFor ? 'bg-for-600 text-white' : 'bg-against-600 text-white'
      )}>
        {rank}
      </div>

      {/* Side indicator */}
      <div className={cn(
        'flex items-center gap-1.5 text-xs font-mono font-semibold',
        isFor ? 'text-for-400' : 'text-against-400'
      )}>
        {isFor ? (
          <ThumbsUp className="h-3 w-3" />
        ) : (
          <ThumbsDown className="h-3 w-3" />
        )}
        {isFor ? 'FOR' : 'AGAINST'}
        {arg.ai_grade && (
          <span className={cn('ml-auto font-bold', gradeColor(arg.ai_grade))}>
            {arg.ai_grade}
          </span>
        )}
      </div>

      {/* Quote body */}
      <div className="relative">
        <Quote className={cn(
          'absolute -top-1 -left-1 h-5 w-5 opacity-20',
          isFor ? 'text-for-400' : 'text-against-400'
        )} />
        <p className="text-sm text-white leading-relaxed pl-5 line-clamp-5">
          {arg.content}
        </p>
      </div>

      {/* Footer: author + stats */}
      <div className="flex items-center gap-3 mt-auto">
        {author ? (
          <Link
            href={`/profile/${author.username}`}
            className="flex items-center gap-2 min-w-0 flex-1 group/author"
          >
            <Avatar
              src={author.avatar_url}
              fallback={author.display_name || author.username}
              size="xs"
            />
            <div className="min-w-0">
              <p className="text-xs font-medium text-surface-300 group-hover/author:text-white transition-colors truncate">
                {author.display_name || author.username}
              </p>
              <p className="text-[10px] text-surface-500 truncate">
                @{author.username} · {relativeTime(arg.created_at)}
              </p>
            </div>
          </Link>
        ) : (
          <div className="flex-1 text-xs text-surface-600 italic">Anonymous</div>
        )}

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Upvote count */}
          <div className={cn(
            'flex items-center gap-1 text-xs font-mono font-semibold',
            isFor ? 'text-for-400' : 'text-against-400'
          )}>
            <TrendingUp className="h-3.5 w-3.5" />
            {arg.upvotes.toLocaleString()}
          </div>

          {/* Copy button */}
          <button
            onClick={copyQuote}
            title="Copy quote"
            className={cn(
              'flex items-center justify-center h-6 w-6 rounded-md transition-colors',
              'text-surface-500 hover:text-white hover:bg-surface-300',
              'opacity-0 group-hover:opacity-100'
            )}
          >
            {copied ? (
              <span className="text-[9px] font-mono text-emerald">✓</span>
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionDivider({ side, count }: { side: 'for' | 'against'; count: number }) {
  const isFor = side === 'for'
  return (
    <div className={cn(
      'flex items-center gap-3 py-2',
      isFor ? 'text-for-400' : 'text-against-400'
    )}>
      <div className={cn('h-px flex-1', isFor ? 'bg-for-800/60' : 'bg-against-800/60')} />
      <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest">
        {isFor ? (
          <ThumbsUp className="h-3.5 w-3.5" />
        ) : (
          <ThumbsDown className="h-3.5 w-3.5" />
        )}
        {isFor ? 'For' : 'Against'} · {count} arguments
      </div>
      <div className={cn('h-px flex-1', isFor ? 'bg-for-800/60' : 'bg-against-800/60')} />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function QuotesClient({
  topicId,
  statement,
  category,
  status,
  bluePct,
  totalVotes,
}: QuotesClientProps) {
  const [args, setArgs] = useState<TopicArgumentWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sideFilter, setSideFilter] = useState<SideFilter>('all')
  const [sortBy, setSortBy] = useState<'upvotes' | 'quality'>('upvotes')
  const [showAll, setShowAll] = useState(false)
  const [sharing, setSharing] = useState(false)

  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct
  const statusLabel = STATUS_LABEL[status] ?? status
  const statusBadge = STATUS_BADGE[status] ?? 'proposed'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/topics/${topicId}/arguments?sort=${sortBy === 'quality' ? 'quality' : 'top'}`
      )
      if (!res.ok) throw new Error('Failed to load arguments')
      const json = await res.json()
      setArgs(json.arguments ?? [])
    } catch {
      setError('Could not load arguments. Try again.')
    } finally {
      setLoading(false)
    }
  }, [topicId, sortBy])

  useEffect(() => {
    load()
  }, [load])

  // Filter by side
  const filtered = args.filter((a) => {
    if (sideFilter === 'for') return a.side === 'blue'
    if (sideFilter === 'against') return a.side === 'red'
    return true
  })

  const forArgs = filtered.filter((a) => a.side === 'blue')
  const againstArgs = filtered.filter((a) => a.side === 'red')

  const INITIAL_COUNT = 6
  const displayedFor = showAll ? forArgs : forArgs.slice(0, INITIAL_COUNT)
  const displayedAgainst = showAll ? againstArgs : againstArgs.slice(0, INITIAL_COUNT)
  const hasMore = (forArgs.length > INITIAL_COUNT || againstArgs.length > INITIAL_COUNT) && !showAll

  async function shareDebate() {
    if (sharing) return
    setSharing(true)
    const url = window.location.href
    if (navigator.share) {
      await navigator.share({ title: statement, url }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(url).catch(() => {})
    }
    setTimeout(() => setSharing(false), 1500)
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back + breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <Link
            href={`/topic/${topicId}`}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to topic"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-0.5">
              {category ?? 'Debate'} · Quotes
            </p>
            <h1 className="text-base font-bold text-white line-clamp-2 leading-snug">
              {statement}
            </h1>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <Badge variant={statusBadge}>{statusLabel}</Badge>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-for-400 font-semibold">{forPct}% FOR</span>
            <span className="text-surface-600">·</span>
            <span className="text-against-400 font-semibold">{againstPct}% AGAINST</span>
            <span className="text-surface-600">·</span>
            <span className="text-surface-500">{totalVotes.toLocaleString()} votes</span>
          </div>

          {/* Vote bar */}
          <div className="flex-1 min-w-24 h-1.5 bg-surface-300 rounded-full overflow-hidden">
            <div
              className="h-full bg-for-500 rounded-full transition-all"
              style={{ width: `${forPct}%` }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          {/* Side filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-200 border border-surface-300">
            {(['all', 'for', 'against'] as SideFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setSideFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all capitalize',
                  sideFilter === f
                    ? f === 'for'
                      ? 'bg-for-600 text-white'
                      : f === 'against'
                        ? 'bg-against-600 text-white'
                        : 'bg-surface-100 text-white'
                    : 'text-surface-500 hover:text-white'
                )}
              >
                {f === 'all' ? 'All' : f === 'for' ? 'FOR' : 'AGAINST'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Sort */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-200 border border-surface-300">
              {(['upvotes', 'quality'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all capitalize',
                    sortBy === s
                      ? 'bg-surface-100 text-white'
                      : 'text-surface-500 hover:text-white'
                  )}
                >
                  {s === 'upvotes' ? 'Top' : 'Quality'}
                </button>
              ))}
            </div>

            {/* Share */}
            <button
              onClick={shareDebate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:bg-surface-300 transition-all"
            >
              <Share2 className="h-3.5 w-3.5" />
              {sharing ? 'Copied!' : 'Share'}
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-2xl" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <p className="text-sm text-against-400">{error}</p>
            <button
              onClick={load}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm text-surface-400 hover:text-white transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            icon={MessageSquare}
            title="No arguments yet"
            description={
              sideFilter === 'all'
                ? 'Be the first to make a case in this debate.'
                : `No ${sideFilter === 'for' ? 'FOR' : 'AGAINST'} arguments yet.`
            }
            actions={[
              {
                label: 'Make your case',
                href: `/topic/${topicId}`,
                icon: MessageSquare,
              },
            ]}
          />
        )}

        {/* Quote cards */}
        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-8">

            {/* FOR section */}
            {(sideFilter === 'all' || sideFilter === 'for') && displayedFor.length > 0 && (
              <div>
                {sideFilter === 'all' && (
                  <SectionDivider side="for" count={forArgs.length} />
                )}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <AnimatePresence mode="popLayout">
                    {displayedFor.map((arg, i) => (
                      <QuoteCard key={arg.id} arg={arg} rank={i + 1} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* AGAINST section */}
            {(sideFilter === 'all' || sideFilter === 'against') && displayedAgainst.length > 0 && (
              <div>
                {sideFilter === 'all' && (
                  <SectionDivider side="against" count={againstArgs.length} />
                )}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <AnimatePresence mode="popLayout">
                    {displayedAgainst.map((arg, i) => (
                      <QuoteCard key={arg.id} arg={arg} rank={i + 1} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Show more */}
            {hasMore && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => setShowAll(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:bg-surface-300 transition-all"
                >
                  <ChevronDown className="h-4 w-4" />
                  Show all arguments
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer links */}
        {!loading && !error && (
          <div className="flex items-center justify-center gap-6 mt-12 pt-8 border-t border-surface-300">
            <Link
              href={`/topic/${topicId}/arguments`}
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Full debate thread
            </Link>
            <Link
              href={`/topic/${topicId}/steelman`}
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
            >
              <Award className="h-3.5 w-3.5" />
              Steelman arguments
            </Link>
            <Link
              href={`/topic/${topicId}/synthesis`}
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Common ground
            </Link>
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
