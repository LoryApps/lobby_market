'use client'

/**
 * /standoff — The Civic Standoff
 *
 * Surfaces topics where neither side can tip the balance — debates stuck near
 * 50/50 with active recent voting confirming the deadlock persists. Unlike
 * /extremes (which shows current closest-to-50 topics), the Standoff verifies
 * the deadlock is PERSISTENT: recent votes are also near 50/50.
 *
 * Distinct from:
 *   /extremes       — current fault lines (no persistence check)
 *   /battleground   — most argued/commented topics
 *   /convergence    — relative consensus direction
 *   /undertow       — momentum vs. surface divergence
 *   /crossfire      — argument battles
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Gavel,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Timer,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useVoteStore } from '@/lib/stores/vote-store'
import { cn } from '@/lib/utils/cn'
import type { StandoffResponse, StandoffTopic, StandoffArgument } from '@/app/api/standoff/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_MS = 90_000

// ─── Category styles ──────────────────────────────────────────────────────────

const CAT_STYLE: Record<string, { text: string; dot: string; pill: string }> = {
  Economics:   { text: 'text-gold',        dot: 'bg-gold',        pill: 'bg-gold/10 border-gold/30 text-gold'               },
  Politics:    { text: 'text-for-400',     dot: 'bg-for-500',     pill: 'bg-for-500/10 border-for-500/30 text-for-400'      },
  Technology:  { text: 'text-purple',      dot: 'bg-purple',      pill: 'bg-purple/10 border-purple/30 text-purple'         },
  Science:     { text: 'text-emerald',     dot: 'bg-emerald',     pill: 'bg-emerald/10 border-emerald/30 text-emerald'      },
  Ethics:      { text: 'text-against-400', dot: 'bg-against-500', pill: 'bg-against-500/10 border-against-500/30 text-against-400' },
  Philosophy:  { text: 'text-indigo-400',  dot: 'bg-indigo-400',  pill: 'bg-indigo-400/10 border-indigo-400/30 text-indigo-400'   },
  Culture:     { text: 'text-orange-400',  dot: 'bg-orange-400',  pill: 'bg-orange-400/10 border-orange-400/30 text-orange-400'   },
  Health:      { text: 'text-pink-400',    dot: 'bg-pink-400',    pill: 'bg-pink-400/10 border-pink-400/30 text-pink-400'         },
  Environment: { text: 'text-green-400',   dot: 'bg-green-400',   pill: 'bg-green-400/10 border-green-400/30 text-green-400'      },
  Education:   { text: 'text-cyan-400',    dot: 'bg-cyan-400',    pill: 'bg-cyan-400/10 border-cyan-400/30 text-cyan-400'         },
}

function catStyle(cat: string | null) {
  return (
    cat
      ? (CAT_STYLE[cat] ?? { text: 'text-surface-500', dot: 'bg-surface-500', pill: 'bg-surface-300/30 border-surface-400/30 text-surface-500' })
      : { text: 'text-surface-500', dot: 'bg-surface-500', pill: 'bg-surface-300/30 border-surface-400/30 text-surface-500' }
  )
}

// ─── Deadlock label ───────────────────────────────────────────────────────────

function deadlockLabel(margin: number): { label: string; color: string } {
  if (margin < 1)  return { label: 'DEADLOCK', color: 'text-red-400 bg-red-500/10 border-red-500/30' }
  if (margin < 3)  return { label: 'GRIDLOCK', color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' }
  if (margin < 5)  return { label: 'STANDOFF', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' }
  return           { label: 'CONTESTED', color: 'text-surface-400 bg-surface-300/20 border-surface-400/30' }
}

// ─── Argument snippet ─────────────────────────────────────────────────────────

function ArgSnippet({
  arg,
  side,
}: {
  arg: StandoffArgument
  side: 'for' | 'against'
}) {
  const isFor = side === 'for'
  return (
    <Link
      href={`/arguments/${arg.id}`}
      className={cn(
        'block rounded-xl border p-3 transition-colors hover:bg-surface-200/60',
        isFor
          ? 'bg-for-900/20 border-for-700/30 hover:border-for-600/50'
          : 'bg-against-900/20 border-against-700/30 hover:border-against-600/50',
      )}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        {isFor ? (
          <ThumbsUp className="h-3 w-3 text-for-400 flex-shrink-0" aria-hidden="true" />
        ) : (
          <ThumbsDown className="h-3 w-3 text-against-400 flex-shrink-0" aria-hidden="true" />
        )}
        <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wider', isFor ? 'text-for-400' : 'text-against-400')}>
          {isFor ? 'For' : 'Against'}
        </span>
        <span className="ml-auto text-[10px] font-mono text-surface-600 flex items-center gap-0.5">
          <TrendingUp className="h-2.5 w-2.5" aria-hidden="true" />
          {arg.upvotes}
        </span>
      </div>
      <p className="text-[11px] text-surface-300 leading-snug line-clamp-2">
        {arg.content}
      </p>
      {arg.author_username && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <Avatar
            src={arg.author_avatar_url}
            fallback={arg.author_display_name || arg.author_username}
            size="xs"
          />
          <span className="text-[10px] font-mono text-surface-600">
            {arg.author_display_name || `@${arg.author_username}`}
          </span>
        </div>
      )}
    </Link>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function StandoffCard({
  topic,
  rank,
  delay,
}: {
  topic: StandoffTopic
  rank: number
  delay: number
}) {
  const { castVote, hasVoted, getVoteSide } = useVoteStore()
  const voted = hasVoted(topic.id)
  const votedSide = getVoteSide(topic.id)
  const [casting, setCasting] = useState(false)

  const forPct   = Math.round(topic.blue_pct)
  const agstPct  = 100 - forPct
  const style    = catStyle(topic.category)
  const dl       = deadlockLabel(topic.margin)

  async function handleVote(side: 'for' | 'against') {
    if (voted || casting) return
    setCasting(true)
    await castVote(topic.id, side === 'for' ? 'blue' : 'red')
    setCasting(false)
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden hover:border-surface-400 transition-colors"
      aria-label={topic.statement}
    >
      {/* Top bar: rank + category + deadlock label */}
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-0">
        <div className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-surface-300/50 text-[11px] font-mono font-bold text-surface-500">
          {rank}
        </div>
        {topic.category && (
          <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold', style.text)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} aria-hidden="true" />
            {topic.category}
          </span>
        )}
        <span
          className={cn(
            'ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border',
            dl.color,
          )}
        >
          <Swords className="h-2.5 w-2.5" aria-hidden="true" />
          {dl.label}
        </span>
      </div>

      {/* Statement */}
      <div className="px-4 pt-2.5 pb-3">
        <Link
          href={`/topic/${topic.id}`}
          className="block text-sm font-semibold text-white leading-snug hover:text-for-200 transition-colors group"
        >
          {topic.statement}
          <ChevronRight className="inline h-3.5 w-3.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
        </Link>
      </div>

      {/* Vote bar */}
      <div className="px-4 pb-3">
        <div className="flex justify-between text-[11px] font-mono mb-1.5">
          <span className={cn('font-bold', forPct >= 50 ? 'text-for-400' : 'text-surface-500')}>
            {forPct}% FOR
          </span>
          <span className="text-surface-600 text-center">
            {topic.margin.toFixed(1)}pp from centre
          </span>
          <span className={cn('font-bold', agstPct > forPct ? 'text-against-400' : 'text-surface-500')}>
            {agstPct}% AGAINST
          </span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden bg-surface-300 flex relative">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${forPct}%` }}
            transition={{ duration: 0.5, delay: delay + 0.1, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-for-700 to-for-500"
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${agstPct}%` }}
            transition={{ duration: 0.5, delay: delay + 0.1, ease: 'easeOut' }}
            className="h-full bg-gradient-to-l from-against-700 to-against-500 ml-auto"
          />
          {/* Center marker */}
          <div className="absolute inset-y-0 left-1/2 w-px bg-white/30" aria-hidden="true" />
        </div>
      </div>

      {/* Stats strip */}
      <div className="flex items-center gap-3 px-4 pb-3 text-[10px] font-mono text-surface-600">
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" aria-hidden="true" />
          {topic.total_votes.toLocaleString()} total
        </span>
        <span className="flex items-center gap-1">
          <Timer className="h-3 w-3" aria-hidden="true" />
          {topic.recent_votes} recent
        </span>
        <Badge variant={topic.status as 'active' | 'proposed' | 'voting'} className="text-[9px] px-1.5 py-0 ml-auto">
          {topic.status}
        </Badge>
      </div>

      {/* Arguments */}
      {(topic.top_for_arg || topic.top_against_arg) && (
        <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {topic.top_for_arg && (
            <ArgSnippet arg={topic.top_for_arg} side="for" />
          )}
          {topic.top_against_arg && (
            <ArgSnippet arg={topic.top_against_arg} side="against" />
          )}
          {!topic.top_for_arg && topic.top_against_arg && (
            <Link
              href={`/topic/${topic.id}`}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-for-700/30 bg-for-900/10 p-3 text-[11px] font-mono text-for-500 hover:text-for-400 hover:border-for-600/40 transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              Add a FOR argument
            </Link>
          )}
          {!topic.top_against_arg && topic.top_for_arg && (
            <Link
              href={`/topic/${topic.id}`}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-against-700/30 bg-against-900/10 p-3 text-[11px] font-mono text-against-500 hover:text-against-400 hover:border-against-600/40 transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              Add an AGAINST argument
            </Link>
          )}
        </div>
      )}

      {/* Vote CTA */}
      <div className="px-4 pb-4 border-t border-surface-300/60 pt-3">
        {!voted ? (
          <div className="flex gap-2">
            <button
              onClick={() => handleVote('for')}
              disabled={casting}
              aria-label={`Vote FOR: ${topic.statement}`}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-mono font-semibold',
                'border border-for-700/50 bg-for-900/30 text-for-400',
                'hover:bg-for-700/30 hover:border-for-500/60 transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {casting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Break it FOR
            </button>
            <button
              onClick={() => handleVote('against')}
              disabled={casting}
              aria-label={`Vote AGAINST: ${topic.statement}`}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-mono font-semibold',
                'border border-against-700/50 bg-against-900/30 text-against-400',
                'hover:bg-against-700/30 hover:border-against-500/60 transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {casting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Break it AGAINST
            </button>
          </div>
        ) : (
          <div
            className={cn(
              'flex items-center justify-center gap-2 h-9 rounded-xl text-xs font-mono font-semibold border',
              votedSide === 'blue'
                ? 'border-for-700/50 text-for-400 bg-for-900/20'
                : 'border-against-700/50 text-against-400 bg-against-900/20',
            )}
          >
            {votedSide === 'blue' ? (
              <><ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" /> Voted FOR</>
            ) : (
              <><ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" /> Voted AGAINST</>
            )}
          </div>
        )}
      </div>
    </motion.article>
  )
}

// ─── Category filter bar ─────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

function CategoryFilter({
  active,
  onChange,
  available,
}: {
  active: string | null
  onChange: (cat: string | null) => void
  available: Set<string>
}) {
  if (available.size <= 1) return null
  return (
    <div
      className="flex gap-2 flex-wrap"
      role="group"
      aria-label="Filter by category"
    >
      <button
        onClick={() => onChange(null)}
        className={cn(
          'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
          active === null
            ? 'bg-surface-300 border-surface-400 text-white'
            : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white',
        )}
      >
        All
      </button>
      {CATEGORIES.filter((c) => available.has(c)).map((cat) => {
        const s = catStyle(cat)
        return (
          <button
            key={cat}
            onClick={() => onChange(active === cat ? null : cat)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
              active === cat
                ? cn('border-current bg-current/10', s.text)
                : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} aria-hidden="true" />
            {cat}
          </button>
        )
      })}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function StandoffSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading standoffs">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3"
        >
          <div className="flex gap-2">
            <Skeleton className="h-4 w-6 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20 ml-auto rounded-full" />
          </div>
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-2.5 w-full rounded-full" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1 rounded-xl" />
            <Skeleton className="h-9 flex-1 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StandoffClient() {
  const [data, setData] = useState<StandoffResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [catFilter, setCatFilter] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async (refresh = false) => {
    if (!refresh) setLoading(true)
    setError(false)
    try {
      const url = catFilter ? `/api/standoff?category=${encodeURIComponent(catFilter)}` : '/api/standoff'
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch_failed')
      setData(await res.json() as StandoffResponse)
      setLastRefresh(new Date())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [catFilter])

  useEffect(() => {
    fetchData()
    timerRef.current = setInterval(() => fetchData(true), REFRESH_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [fetchData])

  const availableCategories = new Set(
    (data?.topics ?? []).map((t) => t.category).filter(Boolean) as string[]
  )
  const visible = data?.topics.filter(
    (t) => !catFilter || t.category === catFilter
  ) ?? []

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
            <div className="flex items-center gap-2 mb-0.5">
              <Swords className="h-5 w-5 text-yellow-400 flex-shrink-0" aria-hidden="true" />
              <h1 className="font-mono text-xl font-bold text-white">The Civic Standoff</h1>
            </div>
            <p className="text-xs font-mono text-surface-500">
              Debates locked in persistent deadlock — neither side can tip the balance
            </p>
          </div>

          <button
            onClick={() => fetchData(true)}
            disabled={loading}
            aria-label="Refresh standoffs"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
              loading && 'opacity-50 cursor-not-allowed',
            )}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Explainer banner ─────────────────────────────────────── */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-yellow-500/5 border-yellow-500/20 text-xs font-mono text-yellow-200/80">
          <Scale className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            These topics have been <span className="text-yellow-300 font-bold">locked near 50/50 with active recent voting</span> — a true civic standoff. The community is divided. Your vote could break the deadlock.
          </span>
        </div>

        {/* ── Stats bar ─────────────────────────────────────────────── */}
        {data && data.count > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Swords,   label: 'In standoff',   value: data.count,   color: 'text-yellow-400' },
              { icon: Timer,    label: 'Window hours',   value: data.window_hours, color: 'text-purple' },
              { icon: Zap,      label: 'Categories',     value: availableCategories.size, color: 'text-emerald' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-surface-100 border border-surface-300"
              >
                <Icon className={cn('h-4 w-4', color)} aria-hidden="true" />
                <span className="text-lg font-mono font-bold text-white">{value}</span>
                <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider text-center">{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Category filter ───────────────────────────────────────── */}
        {!loading && !error && data && data.count > 0 && (
          <CategoryFilter
            active={catFilter}
            onChange={setCatFilter}
            available={availableCategories}
          />
        )}

        {/* ── Content ───────────────────────────────────────────────── */}
        {loading ? (
          <StandoffSkeleton />
        ) : error ? (
          <EmptyState
            icon={Scale}
            title="Couldn't load standoffs"
            description="Something went wrong fetching the data. Try refreshing."
            actions={[{ label: 'Retry', onClick: () => fetchData() }]}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Gavel}
            title={catFilter ? `No standoffs in ${catFilter}` : 'No civic standoffs right now'}
            description={
              catFilter
                ? 'Try removing the category filter or checking back later.'
                : 'All active debates have a clear lean — the community is speaking decisively. Check back soon.'
            }
            actions={
              catFilter
                ? [{ label: 'Clear filter', onClick: () => setCatFilter(null) }]
                : [{ label: 'See all topics', href: '/' }]
            }
          />
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {visible.map((topic, i) => (
                <StandoffCard
                  key={topic.id}
                  topic={topic}
                  rank={i + 1}
                  delay={0.04 * Math.min(i, 8)}
                />
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
                {' · '}auto-refreshes every {Math.round(REFRESH_MS / 60_000)} min
              </span>
            ) : <span />}
            <div className="flex items-center gap-3">
              <Link href="/extremes" className="hover:text-white transition-colors flex items-center gap-1">
                <Scale className="h-3 w-3" aria-hidden="true" />
                Extremes
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
              <Link href="/battleground" className="hover:text-white transition-colors flex items-center gap-1">
                <Swords className="h-3 w-3" aria-hidden="true" />
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
