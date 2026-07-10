'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronDown,
  GitMerge,
  RefreshCw,
  Star,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TopLeg, TopLegsResponse } from '@/app/api/relays/legs/top/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const SIDE_FILTERS = [
  { id: 'all', label: 'Both Sides' },
  { id: 'for', label: 'FOR', color: 'text-for-400' },
  { id: 'against', label: 'AGAINST', color: 'text-against-400' },
] as const

const PERIOD_FILTERS = [
  { id: '7d', label: 'Past 7 days' },
  { id: '30d', label: 'Past 30 days' },
  { id: 'all', label: 'All time' },
] as const

const CATEGORIES = [
  'All',
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function roleColor(role: string): string {
  switch (role) {
    case 'elder': return 'text-gold'
    case 'troll_catcher': return 'text-emerald'
    case 'debator': return 'text-for-400'
    default: return 'text-surface-400'
  }
}

function roleLabel(role: string): string {
  switch (role) {
    case 'elder': return 'Elder'
    case 'troll_catcher': return 'Troll Catcher'
    case 'debator': return 'Debator'
    default: return 'Citizen'
  }
}

// ─── Leg Card ─────────────────────────────────────────────────────────────────

function LegCard({ leg, rank }: { leg: TopLeg; rank: number }) {
  const [upvoted, setUpvoted] = useState(leg.user_upvoted)
  const [upvoteCount, setUpvoteCount] = useState(leg.upvote_count)
  const [busy, setBusy] = useState(false)

  async function handleUpvote(e: React.MouseEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/relays/${leg.relay_id}/legs/${leg.leg_id}/upvote`, {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json()
        setUpvoted(data.upvoted)
        setUpvoteCount(data.upvote_count)
      }
    } catch {
      // best-effort
    } finally {
      setBusy(false)
    }
  }

  const sideColor = leg.side === 'for' ? 'border-l-for-500 bg-for-500/5' : 'border-l-against-500 bg-against-500/5'
  const sideLabel = leg.side === 'for' ? 'FOR' : 'AGAINST'
  const sideBadgeClass = leg.side === 'for'
    ? 'bg-for-500/20 text-for-300 border-for-500/30'
    : 'bg-against-500/20 text-against-300 border-against-500/30'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(rank * 0.04, 0.4) }}
      className={cn(
        'relative rounded-xl border border-surface-300 border-l-4 p-4',
        'hover:border-surface-400 transition-all duration-200',
        sideColor,
      )}
    >
      {/* ── Rank badge ───────────────────────────────────────────────── */}
      <div className="absolute -top-2 -left-2 flex items-center justify-center w-6 h-6 rounded-full bg-surface-200 border border-surface-400 text-[10px] font-mono font-bold text-surface-400">
        {rank}
      </div>

      {/* ── Header row ──────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 mb-3">
        <Link href={`/profile/${leg.author_username}`} className="shrink-0">
          <Avatar
            src={leg.author_avatar_url}
            username={leg.author_username}
            size="sm"
          />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/profile/${leg.author_username}`}
              className="text-sm font-semibold text-white hover:text-for-300 transition-colors"
            >
              {leg.author_display_name ?? leg.author_username}
            </Link>
            <span className={cn('text-xs', roleColor(leg.author_role))}>
              {roleLabel(leg.author_role)}
            </span>
            <span className="text-surface-500 text-[10px] font-mono">
              {relativeTime(leg.created_at)}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={cn('text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border', sideBadgeClass)}>
              {sideLabel}
            </span>
            <span className="text-[10px] font-mono text-surface-500">
              Leg {leg.leg_number} of {leg.relay_max_legs}
            </span>
            {leg.topic_category && (
              <span className="text-[10px] font-mono text-surface-500 bg-surface-200 px-1.5 py-0.5 rounded">
                {leg.topic_category}
              </span>
            )}
          </div>
        </div>

        {/* ── Star upvote button ─────────────────────────────────────── */}
        <button
          onClick={handleUpvote}
          disabled={busy}
          className={cn(
            'shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all',
            upvoted
              ? 'bg-gold/20 border border-gold/50 text-gold hover:bg-gold/30'
              : 'bg-surface-200 border border-surface-300 text-surface-400 hover:text-gold hover:border-gold/30',
          )}
          aria-label={upvoted ? 'Remove star' : 'Star this leg'}
        >
          <Star className={cn('h-3.5 w-3.5', upvoted && 'fill-gold')} />
          <span>{upvoteCount}</span>
        </button>
      </div>

      {/* ── Leg content ──────────────────────────────────────────────── */}
      <p className="text-sm text-surface-700 leading-relaxed mb-3 pl-9">
        {leg.content}
      </p>

      {/* ── Footer: relay context ────────────────────────────────────── */}
      <div className="pl-9">
        {leg.topic_statement && (
          <div className="mb-2">
            <Link
              href={leg.topic_id ? `/topic/${leg.topic_id}` : '#'}
              className="text-[11px] text-surface-500 hover:text-white transition-colors line-clamp-1"
            >
              <span className="text-surface-600 mr-1">Topic:</span>
              {leg.topic_statement}
            </Link>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {leg.relay_compelling_pct !== null && (
              <div className="flex items-center gap-1">
                {leg.relay_compelling_pct >= 50 ? (
                  <ThumbsUp className="h-3 w-3 text-for-400" />
                ) : (
                  <ThumbsDown className="h-3 w-3 text-against-400" />
                )}
                <span className={cn(
                  'text-[10px] font-mono',
                  leg.relay_compelling_pct >= 50 ? 'text-for-400' : 'text-against-400'
                )}>
                  {leg.relay_compelling_pct}% compelling
                </span>
              </div>
            )}
            <span className={cn(
              'text-[10px] font-mono px-1.5 py-0.5 rounded',
              leg.relay_status === 'voted' ? 'bg-gold/10 text-gold' :
              leg.relay_status === 'complete' ? 'bg-emerald/10 text-emerald' :
              'bg-surface-200 text-surface-500'
            )}>
              {leg.relay_status === 'voted' ? 'Voted' :
               leg.relay_status === 'complete' ? 'Complete' :
               leg.relay_status === 'in_progress' ? 'In Progress' : 'Open'}
            </span>
          </div>

          <Link
            href={`/relays/${leg.relay_id}`}
            className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
          >
            <GitMerge className="h-3 w-3" />
            View relay
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LegSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300 border-l-4 border-l-surface-400 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-32 rounded" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
        <Skeleton className="h-7 w-14 rounded-lg shrink-0" />
      </div>
      <div className="pl-9 space-y-1.5">
        <Skeleton className="h-3.5 w-full rounded" />
        <Skeleton className="h-3.5 w-5/6 rounded" />
        <Skeleton className="h-3 w-3/4 rounded" />
      </div>
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function TopLegsClient() {
  const [legs, setLegs] = useState<TopLeg[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [side, setSide] = useState<'all' | 'for' | 'against'>('all')
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('30d')
  const [category, setCategory] = useState('All')
  const [catOpen, setCatOpen] = useState(false)
  const catRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        side,
        period,
        category: category === 'All' ? 'all' : category,
        limit: '25',
      })
      const res = await fetch(`/api/relays/legs/top?${params}`)
      if (!res.ok) throw new Error('Failed')
      const data: TopLegsResponse = await res.json()
      setLegs(data.legs)
      setTotal(data.total)
    } catch {
      setLegs([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [side, period, category])

  useEffect(() => { load() }, [load])

  // Close category dropdown on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node)) {
        setCatOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  return (
    <div className="min-h-screen bg-surface-100 flex flex-col">
      <TopBar />

      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full pb-24">
        {/* ── Page header ──────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/relays"
              className="text-surface-500 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Star className="h-5 w-5 text-gold fill-gold/30" />
              Top Relay Legs
            </h1>
          </div>
          <p className="text-sm text-surface-500 pl-6">
            The highest-starred individual contributions across all civic relay chains.
          </p>
        </div>

        {/* ── Filters ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {/* Side filter */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-200 border border-surface-300">
            {SIDE_FILTERS.map(({ id, label, color }) => (
              <button
                key={id}
                onClick={() => setSide(id as 'all' | 'for' | 'against')}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-mono transition-all',
                  side === id
                    ? 'bg-surface-100 text-white shadow-sm'
                    : 'text-surface-500 hover:text-white',
                  side === id && color ? color : '',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Period filter */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-200 border border-surface-300">
            {PERIOD_FILTERS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setPeriod(id as '7d' | '30d' | 'all')}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-mono transition-all',
                  period === id
                    ? 'bg-surface-100 text-white shadow-sm'
                    : 'text-surface-500 hover:text-white',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Category dropdown */}
          <div className="relative" ref={catRef}>
            <button
              onClick={() => setCatOpen((o) => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-all"
            >
              {category}
              <ChevronDown className={cn('h-3 w-3 transition-transform', catOpen && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {catOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full mt-1 left-0 z-30 w-40 rounded-xl border border-surface-300 bg-surface-100 shadow-xl overflow-hidden"
                >
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setCategory(cat); setCatOpen(false) }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs font-mono transition-colors',
                        category === cat
                          ? 'bg-surface-200 text-white'
                          : 'text-surface-400 hover:bg-surface-200 hover:text-white',
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Refresh */}
          <button
            onClick={() => load()}
            disabled={loading}
            className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Results count ────────────────────────────────────────────── */}
        {!loading && (
          <p className="text-[11px] font-mono text-surface-500 mb-4">
            {total} top leg{total !== 1 ? 's' : ''} found
          </p>
        )}

        {/* ── List ────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 8 }, (_, i) => (
              <LegSkeleton key={i} />
            ))}
          </div>
        ) : legs.length === 0 ? (
          <EmptyState
            icon={Star}
            title="No starred legs yet"
            description={
              period !== 'all'
                ? 'No relay legs have received stars in this time period. Try expanding the date range or switching sides.'
                : 'No relay legs have been starred yet. Be the first to star a great argument!'
            }
            action={{ label: 'Browse Relays', href: '/relays' }}
          />
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="wait">
              {legs.map((leg, i) => (
                <LegCard key={leg.leg_id} leg={leg} rank={i + 1} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* ── Bottom CTA ──────────────────────────────────────────────── */}
        {!loading && legs.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-sm text-surface-500 mb-3">
              Want to see a leg earn its stars? Join a relay and contribute.
            </p>
            <Link
              href="/relays"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple/20 border border-purple/40 text-purple hover:bg-purple/30 hover:border-purple/60 transition-colors text-sm font-medium"
            >
              <GitMerge className="h-4 w-4" />
              Browse Open Relays
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
