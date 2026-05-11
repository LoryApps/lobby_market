'use client'

/**
 * /topic/[id]/arguments — Topic Arguments Browser
 *
 * A dedicated full-page view of all arguments for a single topic.
 * Provides richer filtering, sorting, and comparison views than the
 * inline ArgumentThread on the topic page.
 *
 * Filters:  All | FOR | AGAINST
 * Sort:     Top Voted | AI Quality | Newest | Oldest
 * Views:    List (default) | Side-by-Side (desktop)
 */

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Columns2,
  ExternalLink,
  List,
  MessageSquare,
  Network,
  PenLine,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TopicArgumentWithAuthor } from '@/lib/supabase/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type SideFilter = 'all' | 'blue' | 'red'
type SortOption = 'top' | 'quality' | 'new' | 'old'
type ViewMode = 'list' | 'split'

interface TopicSummary {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  total_for_args: number
  total_against_args: number
}

interface Props {
  topic: TopicSummary
  initialArguments: TopicArgumentWithAuthor[]
  currentUserId: string | null
}

// ─── Config ───────────────────────────────────────────────────────────────────

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'top',     label: 'Top Voted' },
  { id: 'quality', label: 'AI Quality' },
  { id: 'new',     label: 'Newest' },
  { id: 'old',     label: 'Oldest' },
]

const GRADE_CONFIG: Record<string, { text: string; bg: string; border: string }> = {
  A: { text: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30' },
  B: { text: 'text-for-300',      bg: 'bg-for-500/10',      border: 'border-for-500/30' },
  C: { text: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30' },
  D: { text: 'text-against-300',  bg: 'bg-against-500/10',  border: 'border-against-500/30' },
  F: { text: 'text-against-400',  bg: 'bg-against-600/10',  border: 'border-against-600/30' },
}

const STATUS_COLOR: Record<string, string> = {
  proposed: 'text-surface-400',
  active: 'text-for-400',
  voting: 'text-gold',
  law: 'text-gold',
  failed: 'text-surface-500',
}

const ROLE_COLORS: Record<string, string> = {
  elder:         'text-gold',
  senator:       'text-purple',
  lawmaker:      'text-gold',
  debator:       'text-for-300',
  troll_catcher: 'text-emerald',
  person:        'text-surface-400',
}

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
  const w = Math.floor(d / 7)
  if (w < 5) return `${w}w ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function sortArguments(args: TopicArgumentWithAuthor[], sort: SortOption): TopicArgumentWithAuthor[] {
  return [...args].sort((a, b) => {
    switch (sort) {
      case 'top':
        return (b.upvotes ?? 0) - (a.upvotes ?? 0) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'quality': {
        const scoreA = a.ai_score ?? -1
        const scoreB = b.ai_score ?? -1
        return scoreB - scoreA || (b.upvotes ?? 0) - (a.upvotes ?? 0)
      }
      case 'new':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'old':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    }
  })
}

// ─── Argument Card ────────────────────────────────────────────────────────────

interface ArgumentCardProps {
  arg: TopicArgumentWithAuthor
  topicId: string
  currentUserId: string | null
  onUpvote: (id: string) => void
  rank?: number
}

function ArgumentCard({ arg, topicId, currentUserId, onUpvote, rank }: ArgumentCardProps) {
  const isFor = arg.side === 'blue'
  const gradeConfig = arg.ai_grade ? GRADE_CONFIG[arg.ai_grade] : null
  const isOwn = arg.user_id === currentUserId

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'relative rounded-2xl bg-surface-100 border transition-all',
        isFor ? 'border-for-500/20 hover:border-for-500/40' : 'border-against-500/20 hover:border-against-500/40',
      )}
    >
      {/* Side accent stripe */}
      <div
        className={cn(
          'absolute left-0 top-4 bottom-4 w-0.5 rounded-full',
          isFor ? 'bg-for-500/50' : 'bg-against-500/50',
        )}
      />

      <div className="p-5 pl-6">
        {/* Header: author + side badge + rank */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            {arg.author ? (
              <Link href={`/profile/${arg.author.username}`} className="flex-shrink-0">
                <Avatar
                  src={arg.author.avatar_url}
                  fallback={arg.author.display_name || arg.author.username}
                  size="sm"
                />
              </Link>
            ) : (
              <div className="h-8 w-8 rounded-full bg-surface-300 flex-shrink-0" />
            )}
            <div className="min-w-0">
              {arg.author ? (
                <Link
                  href={`/profile/${arg.author.username}`}
                  className={cn('text-sm font-mono font-semibold hover:underline truncate block', ROLE_COLORS[arg.author.role] ?? 'text-surface-300')}
                >
                  {arg.author.display_name || arg.author.username}
                </Link>
              ) : (
                <span className="text-sm font-mono text-surface-400">Anonymous</span>
              )}
              <span className="text-xs font-mono text-surface-500">{relativeTime(arg.created_at)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {rank !== undefined && rank <= 3 && (
              <span className={cn(
                'text-xs font-mono font-bold',
                rank === 1 ? 'text-gold' : rank === 2 ? 'text-surface-300' : 'text-against-300',
              )}>
                #{rank}
              </span>
            )}
            {gradeConfig && (
              <span className={cn(
                'text-xs font-mono font-bold px-1.5 py-0.5 rounded border',
                gradeConfig.text, gradeConfig.bg, gradeConfig.border,
              )}>
                {arg.ai_grade}
                {arg.ai_score ? ` · ${arg.ai_score}/10` : ''}
              </span>
            )}
            <span className={cn(
              'text-xs font-mono font-bold px-2 py-0.5 rounded-full border',
              isFor
                ? 'text-for-400 bg-for-500/10 border-for-500/30'
                : 'text-against-400 bg-against-500/10 border-against-500/30',
            )}>
              {isFor ? 'FOR' : 'AGAINST'}
            </span>
            {isOwn && (
              <span className="text-xs font-mono text-surface-500 border border-surface-400/30 px-1.5 py-0.5 rounded">
                You
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <p className="text-sm text-surface-200 leading-relaxed whitespace-pre-wrap mb-4">
          {arg.content}
        </p>

        {/* Source URL */}
        {arg.source_url && (
          <a
            href={arg.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 mb-3 break-all"
          >
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
            <span className="truncate max-w-xs">{arg.source_url}</span>
          </a>
        )}

        {/* Footer: upvote + actions */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Upvote button */}
            <button
              onClick={() => onUpvote(arg.id)}
              disabled={!currentUserId}
              title={currentUserId ? (arg.has_upvoted ? 'Remove upvote' : 'Upvote') : 'Sign in to upvote'}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-all',
                arg.has_upvoted
                  ? 'bg-for-500/20 border-for-500/50 text-for-300'
                  : 'bg-surface-200/50 border-surface-400/30 text-surface-400 hover:border-surface-300 hover:text-surface-200',
                !currentUserId && 'opacity-50 cursor-not-allowed',
              )}
            >
              <ThumbsUp className={cn('h-3 w-3', arg.has_upvoted && 'fill-for-400')} />
              {arg.upvotes ?? 0}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <Link
              href={`/arguments/${arg.id}`}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono text-surface-400 hover:text-surface-200 hover:bg-surface-200/50 border border-transparent hover:border-surface-400/30 transition-all"
            >
              <MessageSquare className="h-3 w-3" />
              Replies
            </Link>
            <Link
              href={`/topic/${topicId}/argue?side=${isFor ? 'against' : 'for'}`}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono text-surface-400 hover:text-surface-200 hover:bg-surface-200/50 border border-transparent hover:border-surface-400/30 transition-all"
            >
              <Scale className="h-3 w-3" />
              Counter
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TopicArgumentsClient({ topic, initialArguments, currentUserId }: Props) {
  const [args, setArgs] = useState<TopicArgumentWithAuthor[]>(initialArguments)
  const [side, setSide] = useState<SideFilter>('all')
  const [sort, setSort] = useState<SortOption>('top')
  const [view, setView] = useState<ViewMode>('list')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchArgs = useCallback(async (sortParam: SortOption, showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch(`/api/topics/${topic.id}/arguments?sort=${sortParam}`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json() as { arguments: TopicArgumentWithAuthor[] }
      setArgs(json.arguments ?? [])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [topic.id])

  const handleUpvote = useCallback(async (argId: string) => {
    if (!currentUserId) return
    const supabase = createClient()

    const current = args.find((a) => a.id === argId)
    if (!current) return
    const wasUpvoted = current.has_upvoted

    // Optimistic update
    setArgs((prev) => prev.map((a) =>
      a.id === argId
        ? { ...a, has_upvoted: !wasUpvoted, upvotes: (a.upvotes ?? 0) + (wasUpvoted ? -1 : 1) }
        : a
    ))

    try {
      if (wasUpvoted) {
        await (await supabase).from('topic_argument_votes').delete().match({ argument_id: argId, user_id: currentUserId })
        await (await supabase).from('topic_arguments').update({ upvotes: (current.upvotes ?? 1) - 1 }).eq('id', argId)
      } else {
        await (await supabase).from('topic_argument_votes').insert({ argument_id: argId, user_id: currentUserId })
        await (await supabase).from('topic_arguments').update({ upvotes: (current.upvotes ?? 0) + 1 }).eq('id', argId)
      }
    } catch {
      // Revert on error
      setArgs((prev) => prev.map((a) =>
        a.id === argId ? { ...a, has_upvoted: wasUpvoted, upvotes: current.upvotes } : a
      ))
    }
  }, [args, currentUserId])

  const handleSortChange = (newSort: SortOption) => {
    setSort(newSort)
    fetchArgs(newSort)
  }

  const filtered = sortArguments(
    args.filter((a) => side === 'all' || a.side === side),
    sort,
  )

  const forArgs = sortArguments(args.filter((a) => a.side === 'blue'), sort)
  const againstArgs = sortArguments(args.filter((a) => a.side === 'red'), sort)

  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  const statusLabel: Record<string, string> = {
    proposed: 'Proposed', active: 'Active', voting: 'Voting', law: 'Law', failed: 'Failed',
  }

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Sticky header wrapper */}
      <div className="sticky top-0 z-20 bg-surface-50/95 backdrop-blur-sm border-b border-surface-300/50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link
            href={`/topic/${topic.id}`}
            className="flex items-center gap-1.5 text-sm font-mono text-surface-400 hover:text-surface-200 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="flex items-center gap-2 min-w-0 flex-1 justify-center">
            <span className={cn('text-xs font-mono font-semibold', STATUS_COLOR[topic.status] ?? 'text-surface-400')}>
              {statusLabel[topic.status] ?? topic.status}
            </span>
            {topic.category && (
              <span className="text-xs font-mono text-surface-500 truncate max-w-[120px] sm:max-w-none">
                {topic.category}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* View toggle: list vs split */}
            <button
              onClick={() => setView('list')}
              title="List view"
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                view === 'list' ? 'bg-for-500/20 text-for-400' : 'text-surface-500 hover:text-surface-300',
              )}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('split')}
              title="Side-by-side view"
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                view === 'split' ? 'bg-for-500/20 text-for-400' : 'text-surface-500 hover:text-surface-300',
              )}
            >
              <Columns2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Topic header */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h1 className="font-mono text-base sm:text-lg font-bold text-white leading-snug">
              {topic.statement}
            </h1>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Link
                href={`/topic/${topic.id}/argue`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-for-500/10 border border-for-500/30 text-for-400 hover:bg-for-500/20 text-xs font-mono font-semibold transition-all"
              >
                <PenLine className="h-3.5 w-3.5" />
                Argue
              </Link>
            </div>
          </div>

          {/* Vote bar */}
          <div className="space-y-1.5 mb-3">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-for-400 font-bold">{forPct}% FOR</span>
              <span className="text-surface-500">{(topic.total_votes ?? 0).toLocaleString()} votes</span>
              <span className="text-against-400 font-bold">{againstPct}% AGAINST</span>
            </div>
            <div className="h-1.5 rounded-full bg-against-500/20 overflow-hidden">
              <div
                className="h-full bg-for-500 rounded-full transition-all duration-500"
                style={{ width: `${forPct}%` }}
              />
            </div>
          </div>

          {/* Argument counts */}
          <div className="flex items-center gap-4 text-xs font-mono text-surface-400">
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-3 w-3 text-for-400" />
              {topic.total_for_args} FOR arguments
            </span>
            <span className="flex items-center gap-1">
              <ThumbsDown className="h-3 w-3 text-against-400" />
              {topic.total_against_args} AGAINST arguments
            </span>
            <Link
              href={`/topic/${topic.id}/argument-graph`}
              className="ml-auto flex items-center gap-1 hover:text-surface-200 transition-colors"
            >
              <Network className="h-3 w-3" />
              Graph
            </Link>
          </div>
        </div>

        {/* Filter + Sort bar */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {/* Side filter pills */}
          <div className="flex items-center gap-1.5 mr-2">
            {(['all', 'blue', 'red'] as SideFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-all',
                  side === s
                    ? s === 'blue'
                      ? 'bg-for-500/20 border-for-500/50 text-for-300'
                      : s === 'red'
                        ? 'bg-against-500/20 border-against-500/50 text-against-300'
                        : 'bg-surface-200 border-surface-400 text-surface-100'
                    : 'border-surface-400/30 text-surface-400 hover:border-surface-400 hover:text-surface-200',
                )}
              >
                {s === 'all' ? `All (${args.length})` : s === 'blue' ? `FOR (${topic.total_for_args})` : `AGAINST (${topic.total_against_args})`}
              </button>
            ))}
          </div>

          {/* Sort options */}
          <div className="flex items-center gap-1 ml-auto">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleSortChange(opt.id)}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all',
                  sort === opt.id
                    ? 'bg-surface-200 border-surface-400 text-surface-100'
                    : 'border-surface-400/30 text-surface-500 hover:text-surface-200',
                )}
              >
                {opt.label}
              </button>
            ))}
            <button
              onClick={() => fetchArgs(sort, true)}
              disabled={refreshing}
              title="Refresh"
              className="p-1.5 rounded-lg text-surface-500 hover:text-surface-200 border border-surface-400/30 hover:border-surface-400 transition-all ml-1"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3 animate-pulse">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-surface-300" />
                  <div className="h-4 w-24 bg-surface-300 rounded" />
                  <div className="h-5 w-12 bg-surface-300 rounded-full ml-auto" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-surface-300 rounded w-full" />
                  <div className="h-4 bg-surface-300 rounded w-5/6" />
                  <div className="h-4 bg-surface-300 rounded w-4/5" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <EmptyState
            icon={<MessageSquare className="h-8 w-8 text-surface-400" />}
            title={side === 'all' ? 'No arguments yet' : `No ${side === 'blue' ? 'FOR' : 'AGAINST'} arguments yet`}
            description={
              side === 'all'
                ? 'Be the first to make a case on this topic.'
                : `No one has argued ${side === 'blue' ? 'for' : 'against'} this yet. Be the first.`
            }
            action={
              <Link href={`/topic/${topic.id}/argue${side !== 'all' ? `?side=${side === 'blue' ? 'for' : 'against'}` : ''}`}>
                <Button variant={side === 'red' ? 'against' : 'for'} size="md">
                  <PenLine className="h-4 w-4" />
                  Write an argument
                </Button>
              </Link>
            }
          />
        )}

        {/* ─── List view ─────────────────────────────────────────────────── */}
        {!loading && filtered.length > 0 && view === 'list' && (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${side}-${sort}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              {filtered.map((arg, i) => (
                <ArgumentCard
                  key={arg.id}
                  arg={arg}
                  topicId={topic.id}
                  currentUserId={currentUserId}
                  onUpvote={handleUpvote}
                  rank={i + 1}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ─── Split view (FOR vs AGAINST side-by-side) ─────────────────── */}
        {!loading && view === 'split' && (
          <AnimatePresence mode="wait">
            <motion.div
              key={`split-${sort}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {/* FOR column */}
              <div>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <ThumbsUp className="h-4 w-4 text-for-400" />
                  <span className="font-mono text-sm font-bold text-for-400">FOR</span>
                  <span className="text-xs font-mono text-surface-500">({forArgs.length})</span>
                </div>
                {forArgs.length === 0 ? (
                  <div className="rounded-2xl bg-surface-100/50 border border-for-500/10 p-6 text-center">
                    <p className="text-xs font-mono text-surface-500">No FOR arguments yet</p>
                    <Link href={`/topic/${topic.id}/argue?side=for`} className="text-xs font-mono text-for-400 hover:underline mt-1 block">
                      Make the case →
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {forArgs.map((arg, i) => (
                      <ArgumentCard key={arg.id} arg={arg} topicId={topic.id} currentUserId={currentUserId} onUpvote={handleUpvote} rank={i + 1} />
                    ))}
                  </div>
                )}
              </div>

              {/* AGAINST column */}
              <div>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <ThumbsDown className="h-4 w-4 text-against-400" />
                  <span className="font-mono text-sm font-bold text-against-400">AGAINST</span>
                  <span className="text-xs font-mono text-surface-500">({againstArgs.length})</span>
                </div>
                {againstArgs.length === 0 ? (
                  <div className="rounded-2xl bg-surface-100/50 border border-against-500/10 p-6 text-center">
                    <p className="text-xs font-mono text-surface-500">No AGAINST arguments yet</p>
                    <Link href={`/topic/${topic.id}/argue?side=against`} className="text-xs font-mono text-against-400 hover:underline mt-1 block">
                      Make the case →
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {againstArgs.map((arg, i) => (
                      <ArgumentCard key={arg.id} arg={arg} topicId={topic.id} currentUserId={currentUserId} onUpvote={handleUpvote} rank={i + 1} />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* Footer nav */}
        {!loading && filtered.length > 0 && (
          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap text-xs font-mono text-surface-500">
            <Link href={`/topic/${topic.id}`} className="hover:text-surface-200 transition-colors flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" />
              Topic page
            </Link>
            <span className="text-surface-600">·</span>
            <Link href={`/topic/${topic.id}/versus`} className="hover:text-surface-200 transition-colors flex items-center gap-1">
              <Scale className="h-3 w-3" />
              FOR vs AGAINST
            </Link>
            <span className="text-surface-600">·</span>
            <Link href={`/topic/${topic.id}/argument-graph`} className="hover:text-surface-200 transition-colors flex items-center gap-1">
              <Network className="h-3 w-3" />
              Argument graph
            </Link>
            <span className="text-surface-600">·</span>
            <Link href={`/topic/${topic.id}/argue`} className="hover:text-surface-200 transition-colors flex items-center gap-1">
              <PenLine className="h-3 w-3" />
              Add argument
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
