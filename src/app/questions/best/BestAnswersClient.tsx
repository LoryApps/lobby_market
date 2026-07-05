'use client'

/**
 * /questions/best — Best Answered Questions
 *
 * Curated archive of civic Q&A pairs where questions have been answered
 * and the community has verified the best answers via upvotes.
 *
 * Distinct from:
 *   /questions           — hub browsing all open questions
 *   /questions/unanswered — queue of questions needing answers
 *   /questions/leaders   — top answerers by count (not quality)
 *   /questions/by-expert — expert-filtered answers (not sorted by quality)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Filter,
  HelpCircle,
  Inbox,
  Loader2,
  MessageSquare,
  RefreshCw,
  Star,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { BestQAPair, BestQAResponse } from '@/app/api/questions/best/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All', 'Politics', 'Economics', 'Technology', 'Ethics',
  'Philosophy', 'Science', 'Culture', 'Health', 'Environment', 'Education',
]

const PERIODS = [
  { id: 'week',  label: 'This week',  icon: Zap },
  { id: 'month', label: 'This month', icon: CalendarDays },
  { id: 'all',   label: 'All time',   icon: Star },
] as const

type PeriodId = (typeof PERIODS)[number]['id']

const ROLE_COLOR: Record<string, string> = {
  person:       'text-surface-400',
  debator:      'text-for-400',
  troll_catcher:'text-emerald',
  elder:        'text-gold',
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  proposed: { label: 'Proposed', className: 'text-surface-500 border-surface-500/40 bg-surface-500/10' },
  active:   { label: 'Active',   className: 'text-for-400 border-for-500/40 bg-for-500/10' },
  voting:   { label: 'Voting',   className: 'text-purple border-purple/40 bg-purple/10' },
  law:      { label: 'Law',      className: 'text-emerald border-emerald/40 bg-emerald/10' },
  failed:   { label: 'Failed',   className: 'text-against-400 border-against-500/40 bg-against-500/10' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2)  return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7)  return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Q&A Card ────────────────────────────────────────────────────────────────

function QACard({ pair, idx }: { pair: BestQAPair; idx: number }) {
  const [expanded, setExpanded] = useState(false)
  const topic = pair.topic
  const statusMeta = topic ? STATUS_BADGE[topic.status] : null
  const forPct = Math.round(topic?.blue_pct ?? 50)
  const againstPct = 100 - forPct

  const questionAuthorColor = ROLE_COLOR[pair.question.author?.role ?? 'person'] ?? 'text-surface-400'
  const answerAuthorColor   = ROLE_COLOR[pair.accepted_answer.author?.role ?? 'person'] ?? 'text-surface-400'

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.04, 0.4) }}
      className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden"
    >
      {/* Topic header */}
      {topic && (
        <Link
          href={`/topic/${topic.id}`}
          className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-surface-300/50 group"
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono text-surface-500 truncate uppercase tracking-wide">
              {topic.category ?? 'General'}
            </p>
            <p className="text-sm text-surface-300 leading-snug line-clamp-1 group-hover:text-white transition-colors">
              {topic.statement}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {statusMeta && (
              <span className={cn(
                'hidden sm:inline-flex px-2 h-5 rounded-full text-[10px] font-mono border items-center',
                statusMeta.className
              )}>
                {statusMeta.label}
              </span>
            )}
            {/* Mini vote bar */}
            <div className="flex items-center gap-1 text-[10px] font-mono">
              <span className="text-for-400">{forPct}%</span>
              <div className="w-10 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                <div
                  className="h-full bg-for-500 rounded-full"
                  style={{ width: `${forPct}%` }}
                />
              </div>
              <span className="text-against-400">{againstPct}%</span>
            </div>
            <ExternalLink className="h-3 w-3 text-surface-500 group-hover:text-surface-300 transition-colors" />
          </div>
        </Link>
      )}

      <div className="p-4 space-y-4">
        {/* Question */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <HelpCircle className="h-4 w-4 text-purple shrink-0 mt-0.5" />
            <p className="text-sm text-white leading-relaxed flex-1">
              {pair.question.content}
            </p>
          </div>

          {/* Question meta */}
          <div className="flex items-center gap-3 ml-6">
            {pair.question.author && (
              <div className="flex items-center gap-1.5">
                <Avatar
                  src={pair.question.author.avatar_url}
                  username={pair.question.author.username}
                  size={14}
                />
                <Link
                  href={`/profile/${pair.question.author.username}`}
                  className={cn('text-[11px] font-mono hover:underline', questionAuthorColor)}
                >
                  {pair.question.author.display_name ?? pair.question.author.username}
                </Link>
              </div>
            )}
            <span className="text-[11px] text-surface-500">
              {relativeTime(pair.question.created_at)}
            </span>
            <div className="flex items-center gap-1 text-[11px] text-surface-500">
              <ThumbsUp className="h-3 w-3" />
              <span>{pair.question.upvotes}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-surface-500">
              <MessageSquare className="h-3 w-3" />
              <span>{pair.question.answer_count}</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-surface-300/50" />
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald/10 border border-emerald/30">
            <CheckCircle2 className="h-3 w-3 text-emerald" />
            <span className="text-[10px] font-mono text-emerald uppercase tracking-wide">Accepted Answer</span>
          </div>
          <div className="flex-1 h-px bg-surface-300/50" />
        </div>

        {/* Accepted answer */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className={cn(
                'text-sm text-surface-300 leading-relaxed',
                !expanded && pair.accepted_answer.content.length > 280 && 'line-clamp-4'
              )}>
                {pair.accepted_answer.content}
              </p>
              {pair.accepted_answer.content.length > 280 && (
                <button
                  onClick={() => setExpanded((e) => !e)}
                  className="mt-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors flex items-center gap-0.5"
                >
                  {expanded ? 'Show less' : 'Read more'}
                  <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
                </button>
              )}
            </div>
          </div>

          {/* Answer meta */}
          <div className="flex items-center justify-between ml-6">
            <div className="flex items-center gap-3">
              {pair.accepted_answer.author && (
                <div className="flex items-center gap-1.5">
                  <Avatar
                    src={pair.accepted_answer.author.avatar_url}
                    username={pair.accepted_answer.author.username}
                    size={14}
                  />
                  <Link
                    href={`/profile/${pair.accepted_answer.author.username}`}
                    className={cn('text-[11px] font-mono hover:underline', answerAuthorColor)}
                  >
                    {pair.accepted_answer.author.display_name ?? pair.accepted_answer.author.username}
                  </Link>
                </div>
              )}
              <span className="text-[11px] text-surface-500">
                {relativeTime(pair.accepted_answer.created_at)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald font-mono">
              <ThumbsUp className="h-3 w-3" />
              <span>{pair.accepted_answer.upvotes}</span>
            </div>
          </div>
        </div>

        {/* Footer: view full thread */}
        {topic && (
          <div className="pt-1 border-t border-surface-300/50">
            <Link
              href={`/topic/${topic.id}/ask?q=${pair.question.id}`}
              className="flex items-center justify-between text-xs text-surface-500 hover:text-surface-300 transition-colors group"
            >
              <span>View full discussion thread</span>
              <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        )}
      </div>
    </motion.article>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function QACardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-surface-300/50">
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <div className="flex gap-2 mt-2">
          <Skeleton className="h-3 w-20 rounded-full" />
          <Skeleton className="h-3 w-12 rounded-full" />
        </div>
      </div>
      <div className="py-2">
        <Skeleton className="h-px w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function BestAnswersClient() {
  const [pairs, setPairs]           = useState<BestQAPair[]>([])
  const [loading, setLoading]       = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore]       = useState(false)
  const [category, setCategory]     = useState('All')
  const [period, setPeriod]         = useState<PeriodId>('all')
  const [showFilters, setShowFilters] = useState(false)
  const offset = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async (reset: boolean) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    if (reset) {
      setLoading(true)
      offset.current = 0
    } else {
      setLoadingMore(true)
    }

    try {
      const params = new URLSearchParams({
        category,
        period,
        limit: '15',
        offset: String(offset.current),
      })
      const res = await fetch(`/api/questions/best?${params}`, { signal: ctrl.signal })
      if (!res.ok) throw new Error('Failed to load')
      const data: BestQAResponse = await res.json()

      if (reset) {
        setPairs(data.pairs)
      } else {
        setPairs((prev) => [...prev, ...data.pairs])
      }
      setHasMore(data.has_more)
      offset.current += data.pairs.length
    } catch (err) {
      if ((err as Error).name !== 'AbortError') console.error(err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [category, period])

  useEffect(() => { load(true) }, [load])

  const ActivePeriodIcon = PERIODS.find((p) => p.id === period)?.icon ?? Star

  return (
    <div className="min-h-screen bg-surface-0 pb-24">
      <TopBar />

      {/* Sticky header */}
      <div className="sticky top-14 z-30 bg-surface-0/95 backdrop-blur border-b border-surface-300">
        <div className="max-w-2xl mx-auto px-4 py-3 space-y-3">
          {/* Title row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link href="/questions" className="text-surface-500 hover:text-white transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div>
                <h1 className="text-base font-bold text-white leading-tight flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-gold" />
                  Best Answers
                </h1>
                <p className="text-xs text-surface-500 font-mono">Accepted answers, ranked by community votes</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => load(true)}
                className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </button>
              <button
                onClick={() => setShowFilters((f) => !f)}
                className={cn(
                  'flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-mono border transition-colors',
                  showFilters
                    ? 'bg-surface-300 border-surface-400 text-white'
                    : 'bg-surface-100 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400'
                )}
              >
                <Filter className="h-3 w-3" />
                Filters
              </button>
            </div>
          </div>

          {/* Period tabs */}
          <div className="flex gap-1.5">
            {PERIODS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setPeriod(id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 h-7 rounded-full text-xs font-mono border transition-colors',
                  period === id
                    ? 'bg-surface-300 border-surface-400 text-white'
                    : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>

          {/* Category filter (expandable) */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="pb-1 flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={cn(
                        'px-3 h-7 rounded-full text-xs font-mono border transition-colors',
                        category === cat
                          ? 'bg-surface-300 border-surface-400 text-white'
                          : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">

        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <QACardSkeleton key={i} />)
        ) : pairs.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No accepted answers yet"
            description={
              category !== 'All'
                ? `No answered questions in ${category} for this period. Try a different category or time range.`
                : 'No answered questions for this period yet. Check back soon as the community builds the knowledge base.'
            }
            action={
              <Link
                href="/questions/unanswered"
                className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Answer open questions
              </Link>
            }
          />
        ) : (
          <>
            <p className="text-xs font-mono text-surface-500 px-1">
              <span className="text-white font-semibold">{pairs.length}</span>
              {hasMore && '+'} Q&A pair{pairs.length !== 1 ? 's' : ''} ·{' '}
              <ActivePeriodIcon className="inline h-3 w-3 mr-0.5" />
              {PERIODS.find((p) => p.id === period)?.label}{' '}
              {category !== 'All' && `· ${category}`}
            </p>

            {pairs.map((pair, i) => (
              <QACard key={`${pair.question.id}-${pair.accepted_answer.id}`} pair={pair} idx={i} />
            ))}

            {hasMore && (
              <div className="py-2 text-center">
                <button
                  onClick={() => load(false)}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-5 h-9 rounded-xl border border-surface-300 bg-surface-100 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
