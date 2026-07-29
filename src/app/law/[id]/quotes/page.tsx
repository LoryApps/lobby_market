'use client'

/**
 * /law/[id]/quotes — Founding Debate Quotes
 *
 * The most upvoted FOR and AGAINST arguments from the debate that
 * established this law, presented as readable quote cards for a
 * quick civic snapshot of the founding rhetoric on both sides.
 *
 * Distinct from:
 *   /law/[id]/debate      — full founding argument threads
 *   /law/[id]/contributors — who made the most impact
 *   /topic/[id]/arguments  — full interactive argument browser
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  Gavel,
  MessageSquare,
  Quote,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { QuotesResponse, DebateQuote } from '@/app/api/laws/[id]/quotes/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNum(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const GRADE_COLOR: Record<string, string> = {
  A: 'text-emerald border-emerald/30 bg-emerald/10',
  B: 'text-for-300 border-for-500/30 bg-for-500/10',
  C: 'text-gold border-gold/30 bg-gold/10',
  D: 'text-against-300 border-against-500/30 bg-against-500/10',
  F: 'text-against-400 border-against-600/30 bg-against-600/10',
}

// ─── Quote Card ───────────────────────────────────────────────────────────────

function QuoteCard({ quote, index }: { quote: DebateQuote; index: number }) {
  const isFor = quote.side === 'blue'
  const gradeClass = quote.ai_grade ? GRADE_COLOR[quote.ai_grade] : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      className={cn(
        'rounded-2xl border p-4 relative overflow-hidden',
        isFor
          ? 'bg-for-900/20 border-for-500/20 hover:border-for-500/40'
          : 'bg-against-900/20 border-against-500/20 hover:border-against-500/40',
        'transition-colors'
      )}
    >
      {/* Side accent bar */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-0.5 rounded-l-2xl',
          isFor ? 'bg-for-500' : 'bg-against-500'
        )}
      />

      {/* Side label */}
      <div className="flex items-center justify-between mb-3 pl-2">
        <div className="flex items-center gap-2">
          {isFor ? (
            <ThumbsUp className="h-3 w-3 text-for-400" />
          ) : (
            <ThumbsDown className="h-3 w-3 text-against-400" />
          )}
          <span className={cn(
            'text-[10px] font-mono font-bold uppercase tracking-wider',
            isFor ? 'text-for-400' : 'text-against-400'
          )}>
            {isFor ? 'For' : 'Against'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {gradeClass && (
            <span className={cn(
              'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border',
              gradeClass
            )}>
              {quote.ai_grade}
            </span>
          )}
          <div className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3 text-surface-500" />
            <span className="text-[10px] font-mono text-surface-500 tabular-nums">
              {formatNum(quote.upvotes)}
            </span>
          </div>
        </div>
      </div>

      {/* Quote body */}
      <blockquote className={cn(
        'pl-2 text-sm font-mono leading-relaxed',
        isFor ? 'text-for-100' : 'text-against-100',
      )}>
        &ldquo;{quote.content}&rdquo;
      </blockquote>

      {/* Author row */}
      {quote.author && (
        <Link
          href={`/profile/${quote.author.username}`}
          className="flex items-center gap-2 mt-3 pl-2 group"
        >
          <Avatar
            src={quote.author.avatar_url}
            username={quote.author.username}
            size="xs"
          />
          <span className="text-[11px] font-mono text-surface-400 group-hover:text-white transition-colors">
            {quote.author.display_name ?? quote.author.username}
          </span>
          <span className="text-surface-600 text-[10px]">·</span>
          <span className="text-[10px] font-mono text-surface-500">
            {relTime(quote.created_at)}
          </span>
        </Link>
      )}
    </motion.div>
  )
}

// ─── Quote Card Skeleton ──────────────────────────────────────────────────────

function QuoteSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-10" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/6" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

type FilterMode = 'all' | 'for' | 'against'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LawQuotesPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<QuotesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterMode>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${id}/quotes`)
      if (!res.ok) throw new Error('Failed to load quotes')
      const json = (await res.json()) as QuotesResponse
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const law = data?.law

  const visibleQuotes = data?.quotes.filter((q) => {
    if (filter === 'for') return q.side === 'blue'
    if (filter === 'against') return q.side === 'red'
    return true
  }) ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-10">

        {/* Back link */}
        <Link
          href={`/law/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to law
        </Link>

        {/* Header */}
        <div className="mb-6">
          {loading ? (
            <>
              <Skeleton className="h-4 w-48 mb-2" />
              <Skeleton className="h-6 w-full" />
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-purple/10 border border-purple/30">
                  <Quote className="h-4 w-4 text-purple" />
                </div>
                <span className="text-xs font-mono text-surface-500 uppercase tracking-widest">
                  Founding Debate Quotes
                </span>
              </div>
              {law && (
                <p className="font-mono text-sm text-surface-300 leading-relaxed line-clamp-2">
                  {law.statement}
                </p>
              )}
            </motion.div>
          )}
        </div>

        {/* Stats row */}
        {data && !loading && (
          <div className="grid grid-cols-3 gap-2 mb-5">
            <div className="rounded-xl bg-surface-100 border border-surface-200 p-3 text-center">
              <div className="text-base font-mono font-bold text-white tabular-nums">
                {data.stats.total}
              </div>
              <div className="text-[10px] font-mono text-surface-500 mt-0.5">arguments</div>
            </div>
            <div className="rounded-xl bg-surface-100 border border-for-500/20 p-3 text-center">
              <div className="text-base font-mono font-bold text-for-400 tabular-nums">
                {data.stats.for_count}
              </div>
              <div className="text-[10px] font-mono text-surface-500 mt-0.5">FOR</div>
            </div>
            <div className="rounded-xl bg-surface-100 border border-against-500/20 p-3 text-center">
              <div className="text-base font-mono font-bold text-against-400 tabular-nums">
                {data.stats.against_count}
              </div>
              <div className="text-[10px] font-mono text-surface-500 mt-0.5">AGAINST</div>
            </div>
          </div>
        )}

        {/* Filter bar */}
        <div className="flex gap-2 mb-5">
          {(['all', 'for', 'against'] as FilterMode[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'flex-1 py-2 rounded-xl text-xs font-mono font-semibold border transition-all capitalize',
                filter === f
                  ? f === 'for'
                    ? 'bg-for-600/20 border-for-500/50 text-for-300'
                    : f === 'against'
                    ? 'bg-against-600/20 border-against-500/50 text-against-300'
                    : 'bg-surface-200 border-surface-300 text-white'
                  : 'bg-surface-100 border-surface-200 text-surface-500 hover:text-white hover:border-surface-300'
              )}
            >
              {f === 'all' ? 'All' : f === 'for' ? 'FOR' : 'AGAINST'}
            </button>
          ))}
        </div>

        {/* Quotes list */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }, (_, i) => <QuoteSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-against-500/20 p-6 text-center space-y-3">
            <p className="text-sm font-mono text-against-400">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 text-xs font-mono px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-white hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={filter}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {visibleQuotes.length === 0 ? (
                <EmptyState
                  icon={<Quote className="h-7 w-7 text-surface-500" />}
                  title="No quotes found"
                  description="No arguments were recorded for this filter."
                />
              ) : (
                visibleQuotes.map((q, i) => (
                  <QuoteCard key={q.id} quote={q} index={i} />
                ))
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Footer links */}
        {data && !loading && (
          <div className="mt-8 flex flex-col gap-2">
            <Link
              href={`/law/${id}/contributors`}
              className="flex items-center justify-between rounded-xl bg-surface-100 border border-surface-200 hover:border-surface-300 px-4 py-3 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-surface-500" />
                <span className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors">
                  See who made the most impact
                </span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-surface-500" />
            </Link>
            <Link
              href={`/law/${id}/debate`}
              className="flex items-center justify-between rounded-xl bg-surface-100 border border-surface-200 hover:border-surface-300 px-4 py-3 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Gavel className="h-3.5 w-3.5 text-surface-500" />
                <span className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors">
                  View the full founding debate record
                </span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-surface-500" />
            </Link>
            {data.topic_id && (
              <Link
                href={`/topic/${data.topic_id}/arguments`}
                className="flex items-center justify-between rounded-xl bg-surface-100 border border-surface-200 hover:border-surface-300 px-4 py-3 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-surface-500" />
                  <span className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors">
                    Browse all arguments on the source topic
                  </span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-surface-500" />
              </Link>
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
