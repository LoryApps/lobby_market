'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Flame,
  GitMerge,
  Loader2,
  RefreshCw,
  Swords,
  ThumbsUp,
  Trophy,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { UncontestedRelay, UncontestedResponse } from '@/app/api/relays/uncontested/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Entry card ───────────────────────────────────────────────────────────────

function UncontestedCard({ entry }: { entry: UncontestedRelay }) {
  const existingSide = entry.relay_side
  const missingSide = entry.missing_side
  const isExistingFor = existingSide === 'for'

  const totalVotes = entry.vote_compelling + entry.vote_not_compelling
  const compellingPct = totalVotes > 0
    ? Math.round((entry.vote_compelling / totalVotes) * 100)
    : null

  // Link to create a relay on the topic with pre-selected side
  const createHref = `/relays/create?topic=${entry.topic_id}&side=${missingSide}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden"
    >
      {/* Topic + missing side banner */}
      <div className={cn(
        'px-4 py-3 border-b flex items-center gap-2',
        missingSide === 'for'
          ? 'border-for-800/30 bg-for-900/10'
          : 'border-against-800/30 bg-against-900/10'
      )}>
        <Swords className={cn(
          'h-3.5 w-3.5 flex-shrink-0',
          missingSide === 'for' ? 'text-for-400' : 'text-against-400'
        )} />
        <p className={cn(
          'text-[11px] font-mono font-bold uppercase tracking-wider',
          missingSide === 'for' ? 'text-for-400' : 'text-against-400'
        )}>
          No {missingSide === 'for' ? 'FOR' : 'AGAINST'} relay yet — be the first
        </p>
      </div>

      <div className="p-4 space-y-3">
        {/* Topic statement */}
        <Link
          href={`/topic/${entry.topic_id}`}
          className="block text-sm font-mono font-semibold text-white leading-snug hover:text-for-300 transition-colors"
        >
          {entry.topic_statement}
        </Link>

        {/* Category + status */}
        <div className="flex items-center gap-2 flex-wrap">
          {entry.topic_category && (
            <span className="text-[10px] font-mono text-surface-500 bg-surface-200/50 px-2 py-0.5 rounded-full border border-surface-400/20">
              {entry.topic_category}
            </span>
          )}
          {entry.topic_total_votes != null && (
            <span className="text-[10px] font-mono text-surface-600">
              {entry.topic_total_votes.toLocaleString()} votes
            </span>
          )}
          {entry.topic_blue_pct != null && (
            <span className="text-[10px] font-mono text-for-500">
              {Math.round(entry.topic_blue_pct)}% FOR
            </span>
          )}
        </div>

        {/* Existing relay summary */}
        <div className={cn(
          'rounded-xl border p-3 space-y-2',
          isExistingFor
            ? 'bg-for-900/10 border-for-800/30'
            : 'bg-against-900/10 border-against-800/30'
        )}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <GitMerge className={cn(
                'h-3 w-3',
                isExistingFor ? 'text-for-400' : 'text-against-400'
              )} />
              <span className={cn(
                'text-[10px] font-mono font-bold uppercase tracking-wider',
                isExistingFor ? 'text-for-400' : 'text-against-400'
              )}>
                {isExistingFor ? 'FOR' : 'AGAINST'} Relay — {entry.leg_count}/{entry.max_legs} legs
              </span>
            </div>
            {compellingPct !== null && (
              <div className="flex items-center gap-1 text-[10px] font-mono text-emerald">
                <ThumbsUp className="h-2.5 w-2.5" />
                {compellingPct}% compelling
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-surface-500">
            <Avatar
              src={entry.starter_avatar_url}
              fallback={entry.starter_display_name || entry.starter_username}
              size="xs"
            />
            <Link
              href={`/profile/${entry.starter_username}`}
              className="hover:text-white transition-colors"
            >
              @{entry.starter_username}
            </Link>
            <span className="text-surface-600">·</span>
            <span>{relativeTime(entry.relay_created_at)}</span>
            <span className="text-surface-600">·</span>
            <Link
              href={`/relays/${entry.relay_id}`}
              className="hover:text-white transition-colors flex items-center gap-0.5"
            >
              Read chain
              <ArrowRight className="h-2.5 w-2.5" />
            </Link>
          </div>
        </div>

        {/* CTA */}
        <Link
          href={createHref}
          className={cn(
            'flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-mono font-semibold transition-all border',
            missingSide === 'for'
              ? 'bg-for-600 hover:bg-for-500 text-white border-for-500/50'
              : 'bg-against-600 hover:bg-against-500 text-white border-against-500/50'
          )}
        >
          <GitMerge className="h-4 w-4" />
          Start the {missingSide === 'for' ? 'FOR' : 'AGAINST'} Relay
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-300 bg-surface-200/20">
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
        <div className="flex gap-2">
          <Skeleton className="h-4 w-20 rounded-full" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="rounded-xl border border-surface-300 p-3 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Sort = 'votes' | 'newest' | 'compelling'
type Missing = 'all' | 'for' | 'against'

export function UncontestedClient() {
  const [entries, setEntries] = useState<UncontestedRelay[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<Sort>('votes')
  const [category, setCategory] = useState<string | null>(null)
  const [missing, setMissing] = useState<Missing>('all')

  const fetchEntries = useCallback(async (p = 1, reset = false) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), sort })
      if (category) params.set('category', category)
      if (missing !== 'all') params.set('missing', missing)

      const res = await fetch(`/api/relays/uncontested?${params}`, { cache: 'no-store' })
      if (res.ok) {
        const json: UncontestedResponse = await res.json()
        setEntries((prev) => reset ? json.entries : [...prev, ...json.entries])
        setTotal(json.total)
        setPage(p)
      }
    } finally {
      setLoading(false)
    }
  }, [sort, category, missing])

  useEffect(() => {
    fetchEntries(1, true)
  }, [fetchEntries])

  const hasMore = entries.length < total

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* ── Nav ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-6">
          <Link
            href="/relays"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors flex-shrink-0"
            aria-label="Back to Relays"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-mono font-bold text-white truncate">Uncontested Relays</h1>
            <p className="text-xs font-mono text-surface-500 truncate">
              Only one side has argued — be the opposition
            </p>
          </div>
          <button
            onClick={() => fetchEntries(1, true)}
            aria-label="Refresh"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors flex-shrink-0"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Hero explainer ──────────────────────────────────────────── */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100/60 p-4 mb-6 flex items-start gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-surface-200 border border-surface-300 flex-shrink-0">
            <Swords className="h-5 w-5 text-surface-400" />
          </div>
          <div>
            <p className="text-sm font-mono font-semibold text-white mb-0.5">One side argued. No response.</p>
            <p className="text-xs font-mono text-surface-500 leading-relaxed">
              These topics have a completed relay on one side but no chain arguing the other.
              Start the opposition relay and let the community judge both arguments.
            </p>
          </div>
        </div>

        {/* ── Filters ─────────────────────────────────────────────────── */}
        <div className="space-y-3 mb-6">
          {/* Missing side */}
          <div className="flex items-center gap-2 flex-wrap">
            {(['all', 'for', 'against'] as Missing[]).map((m) => (
              <button
                key={m}
                onClick={() => setMissing(m)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-mono font-semibold transition-colors border',
                  missing === m
                    ? m === 'for'
                      ? 'bg-for-600/20 border-for-600/50 text-for-300'
                      : m === 'against'
                      ? 'bg-against-600/20 border-against-600/50 text-against-300'
                      : 'bg-surface-300 border-surface-400 text-white'
                    : 'bg-surface-200/50 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                )}
              >
                {m === 'all' ? 'All gaps' : m === 'for' ? 'Missing FOR' : 'Missing AGAINST'}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-surface-600">Sort:</span>
              {(['votes', 'newest', 'compelling'] as Sort[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold transition-colors border',
                    sort === s
                      ? 'bg-surface-300 border-surface-400 text-white'
                      : 'bg-surface-200/40 border-surface-300/60 text-surface-600 hover:text-white hover:border-surface-400'
                  )}
                >
                  {s === 'votes' ? 'Most Votes' : s === 'newest' ? 'Newest' : 'Most Compelling'}
                </button>
              ))}
            </div>
          </div>

          {/* Category pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setCategory(null)}
              className={cn(
                'flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold border transition-colors',
                !category
                  ? 'bg-surface-300 border-surface-400 text-white'
                  : 'bg-surface-200/40 border-surface-300/60 text-surface-600 hover:text-white hover:border-surface-400'
              )}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(category === cat ? null : cat)}
                className={cn(
                  'flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold border transition-colors',
                  category === cat
                    ? 'bg-for-600/20 border-for-600/50 text-for-300'
                    : 'bg-surface-200/40 border-surface-300/60 text-surface-600 hover:text-white hover:border-surface-400'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── Count ───────────────────────────────────────────────────── */}
        {!loading && total > 0 && (
          <p className="text-[11px] font-mono text-surface-500 mb-4">
            {total} uncontested relay{total !== 1 ? 's' : ''}
          </p>
        )}

        {/* ── Results ─────────────────────────────────────────────────── */}
        {loading && entries.length === 0 ? (
          <div className="grid gap-4">
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={Trophy}
            iconColor="text-gold"
            iconBg="bg-gold/10"
            iconBorder="border-gold/30"
            title="All debates are balanced"
            description="Every completed relay currently has an opposing chain. Check back later — or start a new topic relay!"
            action={{ label: 'Start a Relay', href: '/relays/create' }}
          />
        ) : (
          <AnimatePresence mode="wait">
            <div className="grid gap-4">
              {entries.map((entry) => (
                <UncontestedCard key={entry.relay_id} entry={entry} />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* ── Load more ───────────────────────────────────────────────── */}
        {hasMore && !loading && (
          <button
            onClick={() => fetchEntries(page + 1)}
            className="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-mono font-medium bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
          >
            <ChevronDown className="h-4 w-4" />
            Load more
          </button>
        )}

        {loading && entries.length > 0 && (
          <div className="mt-6 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-surface-500" />
          </div>
        )}

        {/* ── Footer links ────────────────────────────────────────────── */}
        <div className="mt-8 flex items-center justify-center gap-4 text-xs font-mono text-surface-600">
          <Link href="/relays" className="hover:text-white transition-colors flex items-center gap-1">
            <GitMerge className="h-3 w-3" />
            All Relays
          </Link>
          <span>·</span>
          <Link href="/relays/showdown" className="hover:text-white transition-colors flex items-center gap-1">
            <Swords className="h-3 w-3" />
            Showdown
          </Link>
          <span>·</span>
          <Link href="/relays/create" className="hover:text-purple/80 text-purple transition-colors flex items-center gap-1">
            <Flame className="h-3 w-3" />
            Start a Relay
          </Link>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
