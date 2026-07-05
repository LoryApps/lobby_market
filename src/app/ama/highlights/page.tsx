'use client'

/**
 * /ama/highlights — AMA Insights Archive
 *
 * A curated browser of the most upvoted Q&A pairs from completed expert AMA
 * sessions. Makes ephemeral live-session knowledge permanently discoverable.
 *
 * Distinct from:
 *   /ama          — browse upcoming and live sessions
 *   /ama/[id]     — live Q&A within a single session
 *   /ama/my       — sessions you hosted or attended
 *   /questions/best — topic-level Q&A (not AMA sessions)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  ChevronDown,
  Cpu,
  Crown,
  ExternalLink,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Loader2,
  MessageSquare,
  Mic,
  Music2,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsUp,
  TrendingUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { AMAHighlight, AMAHighlightsResponse } from '@/app/api/ama/highlights/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, {
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
}> = {
  Economics:   { icon: TrendingUp,    color: 'text-gold',        bg: 'bg-gold/10' },
  Politics:    { icon: Landmark,      color: 'text-for-400',     bg: 'bg-for-500/10' },
  Technology:  { icon: Cpu,           color: 'text-purple',      bg: 'bg-purple/10' },
  Science:     { icon: FlaskConical,  color: 'text-emerald',     bg: 'bg-emerald/10' },
  Law:         { icon: Scale,         color: 'text-for-300',     bg: 'bg-for-400/10' },
  Education:   { icon: GraduationCap, color: 'text-gold',        bg: 'bg-gold/10' },
  Health:      { icon: Heart,         color: 'text-emerald',     bg: 'bg-emerald/10' },
  Culture:     { icon: Music2,        color: 'text-against-400', bg: 'bg-against-500/10' },
  Environment: { icon: Leaf,          color: 'text-emerald',     bg: 'bg-emerald/10' },
}

const CATEGORIES = ['All', ...Object.keys(CATEGORY_CONFIG)]

type SortMode = 'upvotes' | 'recent'
type PeriodMode = 'week' | 'month' | 'all'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  const w = Math.floor(d / 7)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  if (w < 5) return `${w}w ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1) + '…'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function HighlightSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <div className="pl-3 border-l-2 border-surface-400/30 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  )
}

// ─── Featured insight ─────────────────────────────────────────────────────────

function InsightOfTheWeek({ highlight }: { highlight: AMAHighlight }) {
  const catConf = highlight.session_category
    ? (CATEGORY_CONFIG[highlight.session_category] ?? null)
    : null
  const hostName = highlight.host?.display_name ?? highlight.host?.username ?? 'Expert'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/5 via-surface-100 to-surface-100 p-5 md:p-6 overflow-hidden"
    >
      {/* Glow */}
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-gold/10 blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gold/20">
          <Crown className="h-3.5 w-3.5 text-gold" />
        </div>
        <span className="text-xs font-mono font-bold text-gold uppercase tracking-widest">
          Insight of the Week
        </span>
        {highlight.session_category && (
          <span className={cn(
            'ml-auto text-[10px] font-mono font-bold uppercase tracking-wide px-2 py-0.5 rounded-full',
            catConf?.color ?? 'text-surface-500',
            catConf?.bg ?? 'bg-surface-200',
          )}>
            {highlight.session_category}
          </span>
        )}
      </div>

      {/* Session link */}
      <Link
        href={`/ama/${highlight.session_id}`}
        className="text-[10px] font-mono text-surface-500 hover:text-surface-400 flex items-center gap-1 mb-3 group"
      >
        <Mic className="h-3 w-3" />
        <span className="group-hover:underline">{truncate(highlight.session_title, 60)}</span>
        <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </Link>

      {/* Question */}
      <div className="mb-3">
        <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wide mb-1 flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          Question
          {highlight.question_upvotes > 0 && (
            <span className="ml-1 flex items-center gap-0.5 text-for-400">
              <ThumbsUp className="h-2.5 w-2.5" />
              {highlight.question_upvotes}
            </span>
          )}
        </p>
        <p className="text-sm font-mono text-white leading-relaxed">
          {highlight.question_content}
        </p>
      </div>

      {/* Answer */}
      <div className="pl-4 border-l-2 border-gold/40 mb-4">
        <p className="text-[11px] font-mono text-gold uppercase tracking-wide mb-1.5 flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Expert Answer
        </p>
        <p className="text-sm text-surface-300 leading-relaxed">
          {highlight.answer_content}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link href={`/profile/${highlight.host?.username}`} className="flex items-center gap-2 group">
          <Avatar
            src={highlight.host?.avatar_url ?? null}
            fallback={hostName}
            size="sm"
          />
          <div>
            <p className="text-xs font-mono font-semibold text-white group-hover:text-gold transition-colors">
              {hostName}
            </p>
            <p className="text-[10px] text-surface-500 font-mono capitalize">
              {highlight.host?.role?.replace(/_/g, ' ') ?? 'Expert'}
            </p>
          </div>
        </Link>
        <Link
          href={`/ama/${highlight.session_id}`}
          className="text-xs font-mono text-gold hover:text-gold/80 flex items-center gap-1 transition-colors"
        >
          View session
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Highlight card ────────────────────────────────────────────────────────────

function HighlightCard({ highlight, index }: { highlight: AMAHighlight; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const catConf = highlight.session_category
    ? (CATEGORY_CONFIG[highlight.session_category] ?? null)
    : null
  const CatIcon = catConf?.icon ?? Mic
  const hostName = highlight.host?.display_name ?? highlight.host?.username ?? 'Expert'
  const answerTrunc = truncate(highlight.answer_content, 220)
  const needsExpand = highlight.answer_content.length > 220

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400/60 transition-colors p-5 space-y-3"
    >
      {/* Top row: category + session */}
      <div className="flex items-center gap-2 flex-wrap">
        {highlight.session_category && catConf && (
          <span className={cn(
            'flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wide px-2 py-0.5 rounded-full',
            catConf.color,
            catConf.bg,
          )}>
            <CatIcon className="h-2.5 w-2.5" />
            {highlight.session_category}
          </span>
        )}
        <Link
          href={`/ama/${highlight.session_id}`}
          className="text-[10px] font-mono text-surface-500 hover:text-surface-400 flex items-center gap-0.5 group truncate max-w-[200px]"
        >
          <Mic className="h-2.5 w-2.5 flex-shrink-0" />
          <span className="truncate group-hover:underline">{highlight.session_title}</span>
        </Link>
        <span className="ml-auto text-[10px] font-mono text-surface-600">
          {relativeTime(highlight.answer_created_at)}
        </span>
      </div>

      {/* Question */}
      <div>
        <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-1 flex items-center gap-1">
          <MessageSquare className="h-2.5 w-2.5" />
          Question
          {highlight.question_upvotes > 0 && (
            <span className="ml-1 flex items-center gap-0.5 text-for-400">
              <ThumbsUp className="h-2.5 w-2.5" />
              {highlight.question_upvotes}
            </span>
          )}
        </p>
        <p className="text-sm font-mono text-white leading-snug">
          {highlight.question_content}
        </p>
      </div>

      {/* Answer */}
      <div className="pl-3 border-l-2 border-surface-400/40">
        <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-1 flex items-center gap-1">
          <Sparkles className="h-2.5 w-2.5 text-gold" />
          <span className="text-gold">Answer</span>
        </p>
        <p className="text-sm text-surface-300 leading-relaxed">
          {expanded ? highlight.answer_content : answerTrunc}
        </p>
        {needsExpand && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-1 text-[10px] font-mono text-surface-500 hover:text-surface-400 flex items-center gap-0.5 transition-colors"
          >
            {expanded ? 'Show less' : 'Read more'}
            <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
          </button>
        )}
      </div>

      {/* Host */}
      <div className="flex items-center justify-between pt-1">
        <Link href={`/profile/${highlight.host?.username}`} className="flex items-center gap-2 group">
          <Avatar
            src={highlight.host?.avatar_url ?? null}
            fallback={hostName}
            size="sm"
          />
          <div>
            <p className="text-xs font-mono font-semibold text-white group-hover:text-gold transition-colors leading-none">
              {hostName}
            </p>
            <p className="text-[10px] text-surface-500 font-mono leading-none mt-0.5">
              {highlight.host?.clout ? `${highlight.host.clout.toLocaleString()} clout` : 'Expert'}
            </p>
          </div>
        </Link>
        <Link
          href={`/ama/${highlight.session_id}`}
          className="flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-for-400 transition-colors"
        >
          View session
          <ArrowRight className="h-2.5 w-2.5" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AMAHighlightsPage() {
  const [data, setData] = useState<AMAHighlightsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<string>('All')
  const [sort, setSort] = useState<SortMode>('upvotes')
  const [period, setPeriod] = useState<PeriodMode>('all')
  const [offset, setOffset] = useState(0)
  const LIMIT = 12

  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async (opts: {
    cat: string
    srt: SortMode
    prd: PeriodMode
    off: number
    append: boolean
  }) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    if (opts.append) setLoadingMore(true)
    else setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        sort: opts.srt,
        period: opts.prd,
        limit: String(LIMIT),
        offset: String(opts.off),
      })
      if (opts.cat !== 'All') params.set('category', opts.cat)

      const res = await fetch(`/api/ama/highlights?${params}`, { signal: ctrl.signal })
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as AMAHighlightsResponse

      setData(prev => opts.append && prev
        ? { ...json, highlights: [...prev.highlights, ...json.highlights], insight_of_the_week: prev.insight_of_the_week }
        : json
      )
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError('Could not load highlights. Try again.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    setOffset(0)
    load({ cat: category, srt: sort, prd: period, off: 0, append: false })
  }, [category, sort, period, load])

  const loadMore = useCallback(() => {
    const newOffset = offset + LIMIT
    setOffset(newOffset)
    load({ cat: category, srt: sort, prd: period, off: newOffset, append: true })
  }, [offset, category, sort, period, load])

  const highlights = data?.highlights ?? []
  const total = data?.total ?? 0
  const hasMore = offset + LIMIT < total
  const insight = data?.insight_of_the_week ?? null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pb-28 pt-6 md:pb-12">

        {/* Header */}
        <div className="mb-6">
          <Link
            href="/ama"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to AMA Sessions
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gold/10 border border-gold/20">
              <Award className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="text-xl font-mono font-bold text-white leading-tight">AMA Insights</h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Best Q&amp;A pairs from completed expert sessions
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-3 mb-6">
          {/* Category pills */}
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => { setCategory(cat); setOffset(0) }}
                className={cn(
                  'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-mono font-semibold transition-all',
                  category === cat
                    ? 'bg-for-500 text-white'
                    : 'bg-surface-200 text-surface-400 hover:text-white hover:bg-surface-300',
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Sort + period row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 bg-surface-200 rounded-lg p-0.5">
              {(['upvotes', 'recent'] as SortMode[]).map(s => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs font-mono font-semibold transition-all',
                    sort === s ? 'bg-surface-100 text-white' : 'text-surface-500 hover:text-white',
                  )}
                >
                  {s === 'upvotes' ? 'Top' : 'Recent'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 bg-surface-200 rounded-lg p-0.5">
              {(['week', 'month', 'all'] as PeriodMode[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs font-mono font-semibold transition-all capitalize',
                    period === p ? 'bg-surface-100 text-white' : 'text-surface-500 hover:text-white',
                  )}
                >
                  {p === 'all' ? 'All time' : `This ${p}`}
                </button>
              ))}
            </div>
            {!loading && total > 0 && (
              <span className="ml-auto text-xs font-mono text-surface-600">
                {total.toLocaleString()} insight{total !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Insight of the week */}
        {!loading && insight && (
          <div className="mb-6">
            <InsightOfTheWeek highlight={insight} />
          </div>
        )}
        {loading && (
          <div className="mb-6 rounded-2xl bg-surface-100 border border-gold/20 p-5 space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {/* Section label */}
        {!loading && highlights.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="h-3.5 w-3.5 text-surface-500" />
            <span className="text-xs font-mono text-surface-500 uppercase tracking-wide">
              {sort === 'upvotes' ? 'Most upvoted' : 'Most recent'}
              {category !== 'All' ? ` · ${category}` : ''}
              {period !== 'all' ? ` · This ${period}` : ''}
            </span>
          </div>
        )}

        {/* Highlights grid */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => <HighlightSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-against-500/20 p-6 text-center">
            <p className="text-sm font-mono text-against-400 mb-3">{error}</p>
            <button
              onClick={() => load({ cat: category, srt: sort, prd: period, off: 0, append: false })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 text-xs font-mono text-white hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        ) : highlights.length === 0 ? (
          <EmptyState
            icon={Mic}
            title="No insights yet"
            description={
              category !== 'All'
                ? `No completed AMA sessions in ${category} yet. Check back soon.`
                : period === 'week'
                  ? 'No AMA sessions completed this week. Try a wider time range.'
                  : 'No completed AMA sessions yet. Sessions go live soon.'
            }
            action={{ label: 'Browse sessions', href: '/ama' }}
          />
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {highlights.map((h, i) => (
                <HighlightCard key={h.answer_id} highlight={h} index={i} />
              ))}
            </AnimatePresence>

            {/* Load more */}
            {hasMore && (
              <div className="pt-2 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</>
                  ) : (
                    <>Load more<ChevronDown className="h-4 w-4" /></>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Related links */}
        {!loading && (
          <div className="mt-10 pt-6 border-t border-surface-300">
            <p className="text-xs font-mono text-surface-600 uppercase tracking-wide mb-3">Related</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Browse AMA Sessions', href: '/ama', icon: Mic },
                { label: 'My AMA Sessions', href: '/ama/my', icon: Users },
                { label: 'Expert Directory', href: '/experts', icon: Sparkles },
                { label: 'Best Answers', href: '/questions/best', icon: Award },
              ].map(l => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
                >
                  <l.icon className="h-3.5 w-3.5 text-surface-500 group-hover:text-white transition-colors flex-shrink-0" />
                  <span className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors truncate">
                    {l.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
