'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Gavel,
  Loader2,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { EditorialResponse, EditorialTopic } from '@/app/api/editorial/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function AnalysedTopicCard({ topic }: { topic: EditorialTopic }) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const catColor = CATEGORY_COLORS[topic.category ?? ''] ?? 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-surface-200/60 border border-surface-300 p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-mono font-semibold text-white leading-snug flex-1">
          {topic.statement}
        </p>
        <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} className="flex-shrink-0 text-[10px]">
          {topic.status === 'law' ? 'LAW' : topic.status}
        </Badge>
      </div>

      {topic.category && (
        <span className={cn('text-[11px] font-mono font-semibold', catColor)}>
          {topic.category}
        </span>
      )}

      {/* Vote bar */}
      <div className="space-y-1">
        <div className="flex rounded-full overflow-hidden h-1.5">
          <div
            className="bg-for-500 transition-all"
            style={{ width: `${forPct}%` }}
          />
          <div
            className="bg-against-500 transition-all"
            style={{ width: `${againstPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] font-mono">
          <span className="flex items-center gap-1 text-for-400">
            <ThumbsUp className="h-2.5 w-2.5" />
            {forPct}%
          </span>
          <span className="text-surface-500">{topic.total_votes.toLocaleString()} votes</span>
          <span className="flex items-center gap-1 text-against-400">
            {againstPct}%
            <ThumbsDown className="h-2.5 w-2.5" />
          </span>
        </div>
      </div>

      {/* Top arguments preview */}
      {(topic.top_for_arg || topic.top_against_arg) && (
        <div className="space-y-1.5">
          {topic.top_for_arg && (
            <div className="flex gap-2">
              <span className="flex-shrink-0 mt-0.5 h-3.5 w-3.5 rounded-full bg-for-500/20 border border-for-500/40 flex items-center justify-center">
                <ThumbsUp className="h-2 w-2 text-for-400" />
              </span>
              <p className="text-[11px] text-surface-500 leading-relaxed line-clamp-2">
                {topic.top_for_arg}
              </p>
            </div>
          )}
          {topic.top_against_arg && (
            <div className="flex gap-2">
              <span className="flex-shrink-0 mt-0.5 h-3.5 w-3.5 rounded-full bg-against-500/20 border border-against-500/40 flex items-center justify-center">
                <ThumbsDown className="h-2 w-2 text-against-400" />
              </span>
              <p className="text-[11px] text-surface-500 leading-relaxed line-clamp-2">
                {topic.top_against_arg}
              </p>
            </div>
          )}
        </div>
      )}

      <Link
        href={`/topic/${topic.id}`}
        className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-for-400 transition-colors mt-1"
      >
        Read the debate
        <ArrowRight className="h-3 w-3" />
      </Link>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function EditorialSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8 animate-pulse">
      <div className="space-y-4 border-b border-surface-300 pb-8">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-5 w-2/3" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EditorialPage() {
  const [data, setData] = useState<EditorialResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchEditorial = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/editorial', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as EditorialResponse
      setData(json)
    } catch {
      setError('Could not load the editorial. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchEditorial()
  }, [fetchEditorial])

  // Split body into paragraphs
  const paragraphs = data?.body
    ? data.body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
    : []

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 pb-20 md:pb-8">
        {loading ? (
          <EditorialSkeleton />
        ) : error ? (
          <div className="max-w-3xl mx-auto px-4 py-20 text-center">
            <p className="text-surface-500 font-mono text-sm mb-4">{error}</p>
            <button
              onClick={() => fetchEditorial()}
              className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-surface-500 hover:text-white transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        ) : data ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={data.date_key}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-3xl mx-auto px-4 py-8"
            >
              {/* ── Masthead ── */}
              <div className="border-b border-surface-300 pb-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-widest">
                    <BookOpen className="h-3.5 w-3.5" />
                    The Civic Editorial
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
                      <Calendar className="h-3 w-3" />
                      {formatDate(data.date_key + 'T12:00:00')}
                    </span>
                    <button
                      onClick={() => fetchEditorial(true)}
                      disabled={refreshing}
                      aria-label="Refresh editorial"
                      className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
                    </button>
                  </div>
                </div>

                {/* Headline */}
                {data.unavailable ? (
                  <div className="py-12 text-center">
                    <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-surface-200 border border-surface-300 mx-auto mb-4">
                      <Sparkles className="h-6 w-6 text-surface-500" />
                    </div>
                    <p className="font-mono text-lg font-bold text-white mb-2">
                      Editorial Unavailable
                    </p>
                    <p className="text-sm text-surface-500 max-w-sm mx-auto">
                      The AI editorial requires an Anthropic API key. Configure{' '}
                      <code className="text-surface-400">ANTHROPIC_API_KEY</code> to enable it.
                    </p>
                  </div>
                ) : (
                  <>
                    <motion.h1
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="font-mono text-2xl sm:text-3xl font-bold text-white leading-tight mb-3"
                    >
                      {data.headline}
                    </motion.h1>

                    <motion.p
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="text-base text-surface-500 leading-relaxed font-mono italic border-l-2 border-for-500/50 pl-3"
                    >
                      {data.lede}
                    </motion.p>

                    <div className="flex items-center gap-3 mt-4">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500">
                        <Sparkles className="h-3 w-3 text-purple" />
                        Written by Claude · {relativeTime(data.generated_at)}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {!data.unavailable && (
                <>
                  {/* ── Editorial body ── */}
                  <div className="space-y-5 mb-10">
                    {paragraphs.map((para, i) => (
                      <motion.p
                        key={i}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + i * 0.08 }}
                        className="text-surface-600 leading-relaxed font-mono text-sm"
                      >
                        {para}
                      </motion.p>
                    ))}
                  </div>

                  {/* ── Divider ── */}
                  <div className="flex items-center gap-3 mb-8">
                    <div className="flex-1 h-px bg-surface-300" />
                    <span className="text-[11px] font-mono text-surface-500 uppercase tracking-widest">
                      Topics Analysed
                    </span>
                    <div className="flex-1 h-px bg-surface-300" />
                  </div>

                  {/* ── Analysed topics grid ── */}
                  {data.topics.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
                      {data.topics.map((topic) => (
                        <AnalysedTopicCard key={topic.id} topic={topic} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-surface-500 font-mono text-sm text-center py-8">
                      No topics were analysed for this editorial.
                    </p>
                  )}

                  {/* ── Footer CTAs ── */}
                  <div className="border-t border-surface-300 pt-8 flex flex-wrap gap-3">
                    <Link
                      href="/"
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
                    >
                      <Zap className="h-4 w-4" />
                      Vote on the debates
                    </Link>
                    <Link
                      href="/law"
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 text-sm font-mono transition-colors"
                    >
                      <Gavel className="h-4 w-4" />
                      Browse established laws
                    </Link>
                    <Link
                      href="/arguments"
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 text-sm font-mono transition-colors"
                    >
                      <Scale className="h-4 w-4" />
                      Top arguments
                    </Link>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        ) : null}

        {refreshing && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-surface-100 border border-surface-300 shadow-lg text-sm font-mono text-surface-500"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Refreshing editorial…
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
