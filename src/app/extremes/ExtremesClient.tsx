'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  Flame,
  Gavel,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import { useVoteStore } from '@/lib/stores/vote-store'
import type { ExtremesResponse, ExtremeTopic } from '@/app/api/topics/extremes/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_MS = 60_000

// ─── Category styles ──────────────────────────────────────────────────────────

const CAT_STYLE: Record<string, { text: string; dot: string; border: string }> = {
  Economics:   { text: 'text-gold',         dot: 'bg-gold',         border: 'border-gold/30'         },
  Politics:    { text: 'text-for-400',      dot: 'bg-for-500',      border: 'border-for-500/30'      },
  Technology:  { text: 'text-purple',       dot: 'bg-purple',       border: 'border-purple/30'       },
  Science:     { text: 'text-emerald',      dot: 'bg-emerald',      border: 'border-emerald/30'      },
  Ethics:      { text: 'text-against-400',  dot: 'bg-against-500',  border: 'border-against-500/30'  },
  Philosophy:  { text: 'text-indigo-400',   dot: 'bg-indigo-400',   border: 'border-indigo-400/30'   },
  Culture:     { text: 'text-orange-400',   dot: 'bg-orange-400',   border: 'border-orange-400/30'   },
  Health:      { text: 'text-pink-400',     dot: 'bg-pink-400',     border: 'border-pink-400/30'     },
  Environment: { text: 'text-green-400',    dot: 'bg-green-400',    border: 'border-green-400/30'    },
  Education:   { text: 'text-cyan-400',     dot: 'bg-cyan-400',     border: 'border-cyan-400/30'     },
}

function catStyle(cat: string | null) {
  return cat ? (CAT_STYLE[cat] ?? { text: 'text-surface-500', dot: 'bg-surface-500', border: 'border-surface-500/30' })
             : { text: 'text-surface-500', dot: 'bg-surface-500', border: 'border-surface-500/30' }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVotes(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// ─── TopicRow ─────────────────────────────────────────────────────────────────

function TopicRow({
  topic,
  mode,
}: {
  topic: ExtremeTopic
  mode: 'fault' | 'mandate'
}) {
  const { castVote, hasVoted, getVoteSide } = useVoteStore()
  const voted = hasVoted(topic.id)
  const votedSide = getVoteSide(topic.id)
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const style = catStyle(topic.category)
  const dominantSide = forPct >= 50 ? 'for' : 'against'
  const dominantPct = forPct >= 50 ? forPct : againstPct

  async function handleVote(side: 'for' | 'against') {
    if (voted) return
    await castVote(topic.id, side)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'group relative rounded-xl border bg-surface-100 p-4 transition-colors',
        mode === 'fault'
          ? 'border-surface-300 hover:border-surface-400'
          : dominantSide === 'for'
            ? 'border-for-700/40 hover:border-for-600/60'
            : 'border-against-700/40 hover:border-against-600/60',
      )}
    >
      {/* Category + status */}
      <div className="flex items-center gap-2 mb-2.5">
        {topic.category && (
          <span className={cn('flex items-center gap-1.5 text-[11px] font-mono font-semibold', style.text)}>
            <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', style.dot)} />
            {topic.category}
          </span>
        )}
        <Badge variant={topic.status as 'active' | 'proposed' | 'law' | 'failed'} className="text-[10px] px-1.5 py-0">
          {topic.status}
        </Badge>
        <span className="ml-auto text-[11px] font-mono text-surface-600">
          {formatVotes(topic.total_votes)} votes
        </span>
      </div>

      {/* Statement */}
      <Link
        href={`/topic/${topic.id}`}
        className="block text-sm font-semibold text-white leading-snug mb-3 group-hover:text-for-200 transition-colors line-clamp-2"
      >
        {topic.statement}
        <ChevronRight className="inline h-3.5 w-3.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
      </Link>

      {/* Vote bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[11px] font-mono mb-1">
          <span className={cn('font-semibold', forPct > againstPct ? 'text-for-400' : 'text-surface-500')}>
            {forPct}% FOR
          </span>
          {mode === 'fault' && (
            <span className="text-surface-600 font-medium">
              margin: {topic.margin}%
            </span>
          )}
          {mode === 'mandate' && (
            <span className={cn('font-bold', dominantSide === 'for' ? 'text-for-400' : 'text-against-400')}>
              {dominantPct}% {dominantSide === 'for' ? 'FOR' : 'AGAINST'}
            </span>
          )}
          <span className={cn('font-semibold', againstPct > forPct ? 'text-against-400' : 'text-surface-500')}>
            {againstPct}% AGAINST
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden bg-surface-300 flex">
          <div
            className="h-full bg-gradient-to-r from-for-700 to-for-500"
            style={{ width: `${forPct}%` }}
          />
          <div
            className="h-full bg-gradient-to-l from-against-700 to-against-500 ml-auto"
            style={{ width: `${againstPct}%` }}
          />
        </div>
      </div>

      {/* Fault line tension indicator */}
      {mode === 'fault' && (
        <div className="mb-3 flex items-center gap-2">
          <div className="flex-1 h-0.5 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-against-600 via-yellow-500 to-for-600"
              style={{ width: '100%' }}
            />
          </div>
          <span className="text-[10px] font-mono text-yellow-400 font-semibold flex-shrink-0">
            {topic.margin < 3 ? 'DEADLOCK' : topic.margin < 8 ? 'CONTESTED' : 'CLOSE'}
          </span>
        </div>
      )}

      {/* Vote buttons */}
      {!voted ? (
        <div className="flex gap-2">
          <button
            onClick={() => handleVote('for')}
            aria-label={`Vote FOR: ${topic.statement}`}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-mono font-semibold',
              'border border-for-700/50 bg-for-900/30 text-for-400',
              'hover:bg-for-700/30 hover:border-for-500/60 transition-all',
            )}
          >
            <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
            For
          </button>
          <button
            onClick={() => handleVote('against')}
            aria-label={`Vote AGAINST: ${topic.statement}`}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-mono font-semibold',
              'border border-against-700/50 bg-against-900/30 text-against-400',
              'hover:bg-against-700/30 hover:border-against-500/60 transition-all',
            )}
          >
            <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
            Against
          </button>
        </div>
      ) : (
        <div className={cn(
          'flex items-center justify-center gap-2 h-8 rounded-lg text-xs font-mono font-semibold border',
          votedSide === 'for'
            ? 'border-for-700/50 text-for-400 bg-for-900/20'
            : 'border-against-700/50 text-against-400 bg-against-900/20',
        )}>
          {votedSide === 'for'
            ? <><ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" /> Voted FOR</>
            : <><ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" /> Voted AGAINST</>
          }
        </div>
      )}
    </motion.div>
  )
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function TopicSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-3">
      <div className="flex gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-14 ml-auto" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="flex gap-2">
        <Skeleton className="h-8 flex-1 rounded-lg" />
        <Skeleton className="h-8 flex-1 rounded-lg" />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ExtremesClient() {
  const [data, setData] = useState<ExtremesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [activeTab, setActiveTab] = useState<'fault' | 'mandate'>('fault')
  const [catFilter, setCatFilter] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/topics/extremes')
      if (!res.ok) throw new Error('Failed')
      const json = (await res.json()) as ExtremesResponse
      setData(json)
      setLastRefresh(new Date())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    timerRef.current = setInterval(() => fetchData(true), REFRESH_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchData])

  const faultLines = data?.faultLines.filter((t) => !catFilter || t.category === catFilter) ?? []
  const mandates   = data?.mandates.filter((t)   => !catFilter || t.category === catFilter) ?? []
  const current    = activeTab === 'fault' ? faultLines : mandates

  const tabCount = {
    fault:   data?.faultLines.length ?? 0,
    mandate: data?.mandates.length ?? 0,
  }

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-5 pb-24 md:pb-8 space-y-5">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          <Link
            href="/"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0 mt-0.5',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
            )}
            aria-label="Back to home"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white leading-tight">
              Civic Extremes
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              The most contested debates &amp; the strongest mandates
            </p>
          </div>

          <button
            onClick={() => fetchData(true)}
            disabled={loading}
            aria-label="Refresh data"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
              loading && 'opacity-50 cursor-not-allowed',
            )}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────── */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('fault')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-mono font-semibold',
              'border transition-all',
              activeTab === 'fault'
                ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-400'
                : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white',
            )}
          >
            <Scale className="h-4 w-4" aria-hidden="true" />
            Fault Lines
            {tabCount.fault > 0 && (
              <span className="text-[11px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full">
                {tabCount.fault}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('mandate')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-mono font-semibold',
              'border transition-all',
              activeTab === 'mandate'
                ? 'bg-for-700/20 border-for-500/40 text-for-300'
                : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white',
            )}
          >
            <Gavel className="h-4 w-4" aria-hidden="true" />
            Mandates
            {tabCount.mandate > 0 && (
              <span className="text-[11px] bg-for-500/20 text-for-400 px-1.5 py-0.5 rounded-full">
                {tabCount.mandate}
              </span>
            )}
          </button>
        </div>

        {/* ── Explainer ────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'flex items-start gap-3 p-3.5 rounded-xl border text-xs font-mono',
              activeTab === 'fault'
                ? 'bg-yellow-500/5 border-yellow-500/20 text-yellow-200/80'
                : 'bg-for-900/20 border-for-700/30 text-for-200/80',
            )}
          >
            {activeTab === 'fault' ? (
              <>
                <AlertTriangle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  These debates are <span className="text-yellow-400 font-bold">almost perfectly divided</span>.
                  The community is split — your vote could tip the balance. Sorted by smallest margin first.
                </span>
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 text-for-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  These topics have <span className="text-for-400 font-bold">overwhelming consensus</span>.
                  The community has spoken decisively. Sorted by strongest mandate first.
                </span>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* ── Category filters ─────────────────────────────────────── */}
        {data && data.categoryBreakdown.length > 1 && (
          <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter by category">
            <button
              onClick={() => setCatFilter(null)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                catFilter === null
                  ? 'bg-surface-300 border-surface-400 text-white'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white',
              )}
            >
              All
            </button>
            {data.categoryBreakdown.map(({ category }) => {
              const s = catStyle(category)
              return (
                <button
                  key={category}
                  onClick={() => setCatFilter(catFilter === category ? null : category)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                    catFilter === category
                      ? cn('border-current bg-current/10', s.text)
                      : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white',
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} aria-hidden="true" />
                  {category}
                </button>
              )
            })}
          </div>
        )}

        {/* ── Stats strip ──────────────────────────────────────────── */}
        {data && (
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                icon: Scale,
                iconClass: 'text-yellow-400',
                value: tabCount.fault,
                label: 'Contested',
              },
              {
                icon: Gavel,
                iconClass: 'text-for-400',
                value: tabCount.mandate,
                label: 'Decisive',
              },
              {
                icon: BarChart2,
                iconClass: 'text-purple',
                value: data.categoryBreakdown.length,
                label: 'Categories',
              },
            ].map(({ icon: Icon, iconClass, value, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-surface-100 border border-surface-300"
              >
                <Icon className={cn('h-4 w-4', iconClass)} aria-hidden="true" />
                <span className="text-lg font-mono font-bold text-white">{value}</span>
                <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Topic list ───────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading topics">
            {Array.from({ length: 5 }).map((_, i) => (
              <TopicSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load extremes"
            description="Something went wrong fetching the data. Try refreshing."
            actions={[{ label: 'Retry', onClick: () => fetchData() }]}
          />
        ) : current.length === 0 ? (
          <EmptyState
            icon={activeTab === 'fault' ? Scale : Gavel}
            title={catFilter
              ? `No ${activeTab === 'fault' ? 'contested' : 'decisive'} topics in ${catFilter}`
              : activeTab === 'fault'
                ? 'No contested topics right now'
                : 'No decisive mandates right now'
            }
            description={catFilter
              ? 'Try removing the category filter to see more results.'
              : activeTab === 'fault'
                ? 'All active debates have a clear lean. Check back soon.'
                : 'No topics have reached overwhelming consensus yet.'
            }
            actions={catFilter ? [{ label: 'Clear filter', onClick: () => setCatFilter(null) }] : undefined}
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {current.map((topic) => (
                <TopicRow key={topic.id} topic={topic} mode={activeTab} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────── */}
        {!loading && !error && (
          <div className="flex items-center justify-between text-[11px] font-mono text-surface-600 pt-2">
            {lastRefresh ? (
              <span>
                Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-3">
              <Link href="/spectrum" className="hover:text-white transition-colors flex items-center gap-1">
                <BarChart2 className="h-3 w-3" aria-hidden="true" />
                Full Spectrum
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
              <Link href="/battleground" className="hover:text-white transition-colors flex items-center gap-1">
                <Flame className="h-3 w-3" aria-hidden="true" />
                Battleground
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
