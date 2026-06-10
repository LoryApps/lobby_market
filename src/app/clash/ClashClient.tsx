'use client'

/**
 * /clash — The Argument Clash
 *
 * Live head-to-head argument battle dashboard.
 * Shows FOR vs AGAINST argument pairs across trending topics,
 * with live upvote animations and Supabase Realtime updates.
 *
 * Distinct from:
 *   /duel      — single topic carousel, one-at-a-time
 *   /faceoffs  — argument arena leaderboard
 *   /spar      — AI practice debate
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ExternalLink,
  Flame,
  Minus,
  RefreshCw,
  Shield,
  Sparkles,
  Star,
  Swords,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ClashCard, ClashResponse } from '@/app/api/clash/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
  'Politics',
  'Economics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

const SORT_OPTIONS = [
  { id: 'hottest', label: 'Hottest', icon: Flame },
  { id: 'contested', label: 'Most Contested', icon: Swords },
  { id: 'newest', label: 'Newest', icon: Zap },
] as const

type SortId = typeof SORT_OPTIONS[number]['id']

const CATEGORY_COLOR: Record<string, string> = {
  Politics: 'text-for-400',
  Economics: 'text-gold',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m`
  if (h < 24) return `${h}h`
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtNum(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toString()
}

function gradeColor(grade: string | null): string {
  if (!grade) return 'text-surface-500'
  if (['A+', 'A', 'A-'].includes(grade)) return 'text-emerald'
  if (['B+', 'B', 'B-'].includes(grade)) return 'text-for-400'
  if (['C+', 'C', 'C-'].includes(grade)) return 'text-gold'
  return 'text-surface-500'
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ClashSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
          {/* Topic header */}
          <div className="p-4 border-b border-surface-300">
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-3 w-24" />
          </div>
          {/* Two-column arguments */}
          <div className="grid grid-cols-2 divide-x divide-surface-300">
            {['for', 'against'].map((side) => (
              <div key={side} className="p-4 space-y-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-12 w-full" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Upvote button with optimistic animation ──────────────────────────────────

function UpvoteButton({
  argumentId,
  initialUpvotes,
  onUpvote,
}: {
  argumentId: string
  initialUpvotes: number
  onUpvote: (id: string) => Promise<void>
}) {
  const [count, setCount] = useState(initialUpvotes)
  const [voted, setVoted] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => { setCount(initialUpvotes) }, [initialUpvotes])

  const handleClick = async () => {
    if (voted || loading) return
    setLoading(true)
    setVoted(true)
    setCount((c) => c + 1)
    try {
      await onUpvote(argumentId)
    } catch {
      setVoted(false)
      setCount((c) => c - 1)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.button
      onClick={handleClick}
      disabled={loading}
      whileTap={{ scale: 0.9 }}
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-mono font-semibold transition-all',
        voted
          ? 'bg-for-500/20 text-for-300 border border-for-500/30'
          : 'bg-surface-200 text-surface-400 border border-surface-300 hover:border-surface-400 hover:text-surface-200',
        loading && 'opacity-50',
      )}
    >
      <ThumbsUp className="h-3.5 w-3.5" />
      <AnimatePresence mode="wait">
        <motion.span
          key={count}
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 8, opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {fmtNum(count)}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}

// ─── Argument panel ───────────────────────────────────────────────────────────

function ArgumentPanel({
  arg,
  side,
  pct,
  onUpvote,
}: {
  arg: ClashCard['for'] | ClashCard['against']
  side: 'for' | 'against'
  pct: number   // 0-100 share of total upvotes on this side
  onUpvote: (id: string) => Promise<void>
}) {
  const isFor = side === 'for'
  const barColor = isFor ? 'bg-for-500' : 'bg-against-500'
  const labelColor = isFor ? 'text-for-400' : 'text-against-400'
  const gradeBorder = isFor ? 'border-for-500/30 bg-for-500/5' : 'border-against-500/30 bg-against-500/5'

  return (
    <div className={cn('p-4 flex flex-col gap-3 min-h-0', isFor ? 'bg-for-500/5' : 'bg-against-500/5')}>
      {/* Side label */}
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-[10px] font-mono font-bold tracking-widest uppercase', labelColor)}>
          {isFor ? (
            <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />FOR</span>
          ) : (
            <span className="flex items-center gap-1"><ThumbsDown className="h-3 w-3" />AGAINST</span>
          )}
        </span>
        {arg.ai_grade && (
          <span className={cn(
            'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border',
            gradeColor(arg.ai_grade),
            gradeBorder,
          )}>
            {arg.ai_grade}
          </span>
        )}
      </div>

      {/* Argument content */}
      <p className="text-sm text-surface-100 leading-relaxed line-clamp-4 flex-1">
        {arg.content}
      </p>

      {/* Source link */}
      {arg.source_url && (
        <a
          href={arg.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] text-surface-500 hover:text-surface-300 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Source
        </a>
      )}

      {/* Author + upvote */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {arg.author ? (
            <>
              <Avatar
                src={arg.author.avatar_url}
                fallback={arg.author.display_name ?? arg.author.username}
                size="xs"
              />
              <Link
                href={`/profile/${arg.author.username}`}
                className="text-xs text-surface-400 hover:text-white truncate transition-colors"
              >
                {arg.author.display_name ?? arg.author.username}
              </Link>
            </>
          ) : (
            <span className="text-xs text-surface-600">Anonymous</span>
          )}
          <span className="text-[10px] text-surface-600 flex-shrink-0">{relativeTime(arg.created_at)}</span>
        </div>

        <UpvoteButton
          argumentId={arg.id}
          initialUpvotes={arg.upvotes}
          onUpvote={onUpvote}
        />
      </div>

      {/* Upvote share bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-mono text-surface-600">
          <span>{fmtNum(arg.upvotes)} votes</span>
          <span>{Math.round(pct)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', barColor)}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Clash card ───────────────────────────────────────────────────────────────

function ClashCardItem({
  clash,
  index,
  onUpvote,
}: {
  clash: ClashCard
  index: number
  onUpvote: (id: string) => Promise<void>
}) {
  const total = clash.for.upvotes + clash.against.upvotes
  const forPct = total > 0 ? (clash.for.upvotes / total) * 100 : 50
  const againstPct = total > 0 ? (clash.against.upvotes / total) * 100 : 50

  const catColor = CATEGORY_COLOR[clash.topic.category ?? ''] ?? 'text-surface-500'

  const momentumIcon = {
    for: <TrendingUp className="h-3 w-3 text-for-400" />,
    against: <TrendingUp className="h-3 w-3 text-against-400 scale-y-[-1]" />,
    tied: <Minus className="h-3 w-3 text-surface-500" />,
  }[clash.momentum]

  const momentumLabel = {
    for: 'FOR leading',
    against: 'AGAINST leading',
    tied: 'Tied',
  }[clash.momentum]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden hover:border-surface-400 transition-colors"
    >
      {/* Topic header */}
      <div className="px-4 py-3 border-b border-surface-300 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {clash.topic.category && (
            <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wide', catColor)}>
              {clash.topic.category}
            </span>
          )}
          <Link
            href={`/topic/${clash.topic.id}`}
            className="block text-sm font-semibold text-white mt-0.5 hover:text-for-300 transition-colors line-clamp-2"
          >
            {clash.topic.statement}
          </Link>
        </div>

        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          {/* Battle score badge */}
          <div className="flex items-center gap-1 rounded-lg bg-surface-200 border border-surface-300 px-2 py-1">
            <Flame className="h-3 w-3 text-gold" />
            <span className="text-[10px] font-mono font-bold text-gold">{fmtNum(clash.battleScore)}</span>
          </div>

          {/* Momentum indicator */}
          <div className="flex items-center gap-1">
            {momentumIcon}
            <span className="text-[10px] font-mono text-surface-500">{momentumLabel}</span>
          </div>
        </div>
      </div>

      {/* Argument columns */}
      <div className="grid grid-cols-2 divide-x divide-surface-300">
        <ArgumentPanel
          arg={clash.for}
          side="for"
          pct={forPct}
          onUpvote={onUpvote}
        />
        <ArgumentPanel
          arg={clash.against}
          side="against"
          pct={againstPct}
          onUpvote={onUpvote}
        />
      </div>

      {/* Footer: topic vote bar + link */}
      <div className="px-4 py-2.5 border-t border-surface-300 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[10px] font-mono text-for-400 font-semibold">
            {Math.round(clash.topic.blue_pct)}%
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-against-900/60 overflow-hidden">
            <div
              className="h-full rounded-full bg-for-500 transition-all"
              style={{ width: `${clash.topic.blue_pct}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-against-400 font-semibold">
            {Math.round(100 - clash.topic.blue_pct)}%
          </span>
          <span className="text-[10px] font-mono text-surface-600 ml-1">
            <Users className="h-3 w-3 inline mr-0.5" />
            {fmtNum(clash.topic.total_votes)}
          </span>
        </div>

        <Link
          href={`/topic/${clash.topic.id}`}
          className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors flex-shrink-0"
        >
          View topic <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function ClashClient() {
  const [clashes, setClashes] = useState<ClashCard[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState<SortId>('hottest')
  const channelRef = useRef<ReturnType<typeof createClient>['channel'] | null>(null)

  const load = useCallback(async (opts?: { refresh?: boolean; cat?: string; s?: SortId }) => {
    const cat = opts?.cat ?? category
    const s = opts?.s ?? sort
    if (opts?.refresh) setRefreshing(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams({ sort: s, limit: '30' })
      if (cat !== 'All') params.set('category', cat)
      const res = await fetch(`/api/clash?${params}`)
      if (res.ok) {
        const data: ClashResponse = await res.json()
        setClashes(data.clashes)
        setTotal(data.total)
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [category, sort])

  useEffect(() => { load() }, [load])

  // Real-time: watch for upvote changes on topic_argument_votes
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('clash-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'topic_arguments' },
        (payload) => {
          const updated = payload.new as { id: string; upvotes: number }
          setClashes((prev) =>
            prev.map((clash) => {
              if (clash.for.id === updated.id) {
                return { ...clash, for: { ...clash.for, upvotes: updated.upvotes }, battleScore: updated.upvotes + clash.against.upvotes }
              }
              if (clash.against.id === updated.id) {
                return { ...clash, against: { ...clash.against, upvotes: updated.upvotes }, battleScore: clash.for.upvotes + updated.upvotes }
              }
              return clash
            }),
          )
        },
      )
      .subscribe()

    channelRef.current = channel as unknown as ReturnType<typeof createClient>['channel']
    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleUpvote = useCallback(async (argumentId: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('topic_argument_votes')
      .insert({ argument_id: argumentId, user_id: user.id })
      .select()
      .single()

    if (!error) {
      // Increment the upvote count on the argument
      await supabase.rpc('increment_argument_upvotes', { arg_id: argumentId }).catch(() => {
        // Fall back to manual update if RPC doesn't exist
        supabase
          .from('topic_arguments')
          .select('upvotes')
          .eq('id', argumentId)
          .single()
          .then(({ data }) => {
            if (data) {
              supabase
                .from('topic_arguments')
                .update({ upvotes: (data.upvotes ?? 0) + 1 })
                .eq('id', argumentId)
            }
          })
      })
    }
  }, [])

  const handleCategoryChange = (cat: string) => {
    setCategory(cat)
    load({ cat, s: sort })
  }

  const handleSortChange = (s: SortId) => {
    setSort(s)
    load({ cat: category, s })
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-28 md:pb-12">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30">
              <Swords className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">The Clash</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {loading ? 'Loading...' : `${total} live argument battles`}
              </p>
            </div>
          </div>

          <p className="text-sm text-surface-400 mt-1">
            The best FOR and AGAINST arguments face off on every trending topic.
            Upvote the argument that makes the stronger case.
          </p>
        </motion.div>

        {/* ── Stats strip ────────────────────────────────────────────────── */}
        {!loading && clashes.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-4 mb-5 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300"
          >
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-gold" />
              <span className="text-xs font-mono text-surface-300">
                <span className="text-white font-bold">{clashes.length}</span> battles
              </span>
            </div>
            <div className="h-4 w-px bg-surface-400" />
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-for-400" />
              <span className="text-xs font-mono text-surface-300">
                <span className="text-white font-bold">
                  {fmtNum(clashes.reduce((sum, c) => sum + c.battleScore, 0))}
                </span> total votes cast
              </span>
            </div>
            <div className="h-4 w-px bg-surface-400 hidden sm:block" />
            <div className="items-center gap-2 hidden sm:flex">
              <Sparkles className="h-4 w-4 text-purple" />
              <span className="text-xs font-mono text-surface-300">Live · updates in real-time</span>
            </div>
          </motion.div>
        )}

        {/* ── Sort options ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleSortChange(id)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-mono font-semibold border transition-all',
                sort === id
                  ? 'bg-gold/15 border-gold/40 text-gold'
                  : 'bg-surface-100 border-surface-300 text-surface-400 hover:border-surface-400 hover:text-white',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}

          <div className="ml-auto">
            <button
              onClick={() => load({ refresh: true })}
              disabled={refreshing}
              className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Category filter ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={cn(
                'flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-mono font-semibold border transition-all',
                category === cat
                  ? 'bg-for-500/15 border-for-500/40 text-for-300'
                  : 'bg-surface-100 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white',
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        {loading ? (
          <ClashSkeleton />
        ) : clashes.length === 0 ? (
          <EmptyState
            icon={Swords}
            title="No battles yet"
            description={
              category !== 'All'
                ? `No argument clashes found for ${category}. Try a different category.`
                : 'No topics have both FOR and AGAINST arguments yet. Be the first to argue!'
            }
            actions={[
              {
                label: 'Browse topics',
                href: '/topics',
                variant: 'primary',
                icon: Shield,
              },
            ]}
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-4">
              {clashes.map((clash, i) => (
                <ClashCardItem
                  key={`${clash.topic.id}-${clash.for.id}-${clash.against.id}`}
                  clash={clash}
                  index={i}
                  onUpvote={handleUpvote}
                />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* ── Load more hint ──────────────────────────────────────────────── */}
        {!loading && total > clashes.length && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 text-center"
          >
            <p className="text-xs font-mono text-surface-600">
              Showing {clashes.length} of {total} clashes · use category filters to narrow
            </p>
          </motion.div>
        )}

        {/* ── Footer CTA ──────────────────────────────────────────────────── */}
        {!loading && clashes.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 rounded-2xl border border-surface-300 bg-surface-100 p-5 flex items-center gap-4"
          >
            <div className="h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/30 flex items-center justify-center flex-shrink-0">
              <Star className="h-5 w-5 text-for-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Have a better argument?</p>
              <p className="text-xs text-surface-500 mt-0.5">
                Post your take on any topic and compete in the next clash.
              </p>
            </div>
            <Link
              href="/topics"
              className="flex-shrink-0 flex items-center gap-1.5 rounded-lg bg-for-600 hover:bg-for-500 text-white text-xs font-mono font-semibold px-3 py-2 transition-colors"
            >
              Argue <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
