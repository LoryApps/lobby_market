'use client'

/**
 * /analytics/tags — Tag Voting Profile
 *
 * Shows how the authenticated user votes across every civic topic tag:
 *  - FOR/AGAINST split per tag (vs. community average)
 *  - Alignment delta (are you an echo-chamber voter or a contrarian?)
 *  - Tag follow status
 *  - Most-voted topic per tag
 *
 * Distinct from:
 *   /tags/my-tags  — activity digest for followed tags
 *   /tags/radar    — radar comparison chart
 *   /analytics/votes — raw vote history
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart2,
  Bell,
  ChevronRight,
  ExternalLink,
  Hash,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { TagFollowButton } from '@/components/ui/TagFollowButton'
import { cn } from '@/lib/utils/cn'
import type { TagAnalyticsResponse, TagVoteStat } from '@/app/api/analytics/tags/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pctBar(forPct: number, communityPct: number | null, total: number) {
  const against = 100 - forPct
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-for-400 font-semibold">{forPct}% FOR</span>
        <span className="text-surface-500">{total.toLocaleString()} vote{total !== 1 ? 's' : ''}</span>
        <span className="text-against-400 font-semibold">{against}% AGAINST</span>
      </div>
      <div className="relative h-2 rounded-full bg-surface-300 overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-for-600 to-for-500 rounded-full transition-all duration-700"
          style={{ width: `${forPct}%` }}
        />
        {communityPct !== null && (
          <div
            className="absolute top-0 h-full w-0.5 bg-white/40"
            style={{ left: `${communityPct}%` }}
            title={`Community: ${Math.round(communityPct)}% FOR`}
          />
        )}
      </div>
      {communityPct !== null && (
        <div className="flex items-center justify-end gap-1 text-[10px] font-mono text-surface-500">
          <div className="w-1.5 h-1.5 rounded-full bg-white/40 flex-shrink-0" />
          Community avg: {Math.round(communityPct)}%
        </div>
      )}
    </div>
  )
}

function AlignmentChip({ delta }: { delta: number | null }) {
  if (delta === null) return null
  const abs = Math.abs(delta)
  if (abs < 5) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-500 bg-surface-300/60 px-1.5 py-0.5 rounded-full">
        <Scale className="h-2.5 w-2.5" />
        aligned
      </span>
    )
  }
  if (delta > 0) {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full',
        abs >= 20
          ? 'text-for-300 bg-for-500/20'
          : 'text-for-400 bg-for-500/10',
      )}>
        <TrendingUp className="h-2.5 w-2.5" />
        +{delta}% vs community
      </span>
    )
  }
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full',
      abs >= 20
        ? 'text-against-300 bg-against-500/20'
        : 'text-against-400 bg-against-500/10',
    )}>
      <TrendingDown className="h-2.5 w-2.5" />
      {delta}% vs community
    </span>
  )
}

function statusColor(s: string | null) {
  switch (s) {
    case 'law':    return 'text-gold'
    case 'active': return 'text-for-400'
    case 'voting': return 'text-purple'
    case 'failed': return 'text-against-400'
    default:       return 'text-surface-500'
  }
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function TagsSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-12 rounded-full ml-auto" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  )
}

// ─── Tag Card ────────────────────────────────────────────────────────────────

function TagCard({ stat, rank }: { stat: TagVoteStat; rank: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: rank * 0.04 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3"
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Hash className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
          <Link
            href={`/tags/${encodeURIComponent(stat.tag)}`}
            className="font-mono text-sm font-semibold text-white hover:text-for-300 transition-colors truncate"
          >
            {stat.tag}
          </Link>
          <AlignmentChip delta={stat.alignment_delta} />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <TagFollowButton tag={stat.tag} initialFollowing={stat.is_following} size="sm" />
          <Link
            href={`/tags/${encodeURIComponent(stat.tag)}`}
            className="flex items-center justify-center h-6 w-6 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-500 hover:text-white transition-colors"
            aria-label={`Browse #${stat.tag} topics`}
          >
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Vote bar */}
      {pctBar(stat.for_pct, stat.community_for_pct, stat.total)}

      {/* Top topic link */}
      {stat.top_topic_id && stat.top_topic_statement && (
        <div className="pt-0.5">
          <Link
            href={`/topic/${stat.top_topic_id}`}
            className="group flex items-center gap-2 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
          >
            <span className={cn('font-semibold uppercase tracking-wider text-[9px]', statusColor(stat.top_topic_status))}>
              {stat.top_topic_status ?? ''}
            </span>
            <span className="truncate group-hover:text-white">
              {stat.top_topic_statement.slice(0, 80)}
              {stat.top_topic_statement.length > 80 ? '…' : ''}
            </span>
            <ChevronRight className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        </div>
      )}
    </motion.div>
  )
}

// ─── Sort options ─────────────────────────────────────────────────────────────

type SortKey = 'votes' | 'for' | 'against' | 'contrarian'

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'votes',     label: 'Most Voted' },
  { id: 'for',       label: 'Most FOR' },
  { id: 'against',   label: 'Most AGAINST' },
  { id: 'contrarian', label: 'Most Contrarian' },
]

function sortStats(stats: TagVoteStat[], key: SortKey): TagVoteStat[] {
  return [...stats].sort((a, b) => {
    switch (key) {
      case 'votes':     return b.total - a.total
      case 'for':       return b.for_pct - a.for_pct
      case 'against':   return a.for_pct - b.for_pct
      case 'contrarian':
        return Math.abs(b.alignment_delta ?? 0) - Math.abs(a.alignment_delta ?? 0)
    }
  })
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TagAnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<TagAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('votes')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/tags', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load tag analytics')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  // Filter + sort
  const filteredStats = data
    ? sortStats(
        search
          ? data.tags.filter((t) => t.tag.toLowerCase().includes(search.toLowerCase()))
          : data.tags,
        sort,
      )
    : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white">Tag Voting Profile</h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              How your positions align with civic tags
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-40"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Nav strip ── */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-6 text-xs font-mono">
          <Link href="/analytics" className="text-surface-500 hover:text-white transition-colors">← Analytics</Link>
          <Link href="/analytics/votes" className="text-for-400 hover:text-for-300 transition-colors">Vote History</Link>
          <Link href="/analytics/arguments" className="text-purple hover:text-purple/80 transition-colors">Arguments</Link>
          <Link href="/tags/my-tags" className="text-emerald hover:text-emerald/80 transition-colors">My Tags</Link>
          <Link href="/tags/radar" className="text-gold hover:text-gold/80 transition-colors">Tag Radar</Link>
        </div>

        {/* ── Summary cards ── */}
        {data && !loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
              <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Votes cast</div>
              <div className="text-2xl font-mono font-bold text-white">{data.total_votes.toLocaleString()}</div>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
              <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Civic tags</div>
              <div className="text-2xl font-mono font-bold text-white">{data.unique_tags}</div>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 col-span-2">
              <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                <Sparkles className="inline h-3 w-3 text-gold mr-1" />
                Most active tag
              </div>
              {data.most_voted_tag ? (
                <Link
                  href={`/tags/${encodeURIComponent(data.most_voted_tag)}`}
                  className="flex items-center gap-1 text-sm font-mono font-semibold text-gold hover:text-gold/80 transition-colors mt-1"
                >
                  <Hash className="h-3.5 w-3.5" />
                  {data.most_voted_tag}
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              ) : (
                <div className="text-sm font-mono text-surface-500">—</div>
              )}
            </div>
          </div>
        )}

        {/* ── Contrarian banner ── */}
        {data && !loading && data.most_contrarian_tag && (
          <div className="mb-5 rounded-xl bg-against-950/40 border border-against-800/30 px-4 py-3 flex items-center gap-3">
            <Zap className="h-4 w-4 text-against-400 flex-shrink-0" />
            <div className="flex-1 min-w-0 text-xs font-mono text-surface-500">
              You deviate most from community consensus on{' '}
              <Link
                href={`/tags/${encodeURIComponent(data.most_contrarian_tag)}`}
                className="font-semibold text-against-400 hover:text-against-300 transition-colors"
              >
                #{data.most_contrarian_tag}
              </Link>
            </div>
          </div>
        )}

        {/* ── Search + sort ── */}
        {data && !loading && data.tags.length > 0 && (
          <div className="mb-4 space-y-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by tag…"
              className="w-full rounded-xl bg-surface-200 border border-surface-300 px-4 py-2.5 text-sm font-mono text-white placeholder:text-surface-500 outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/30 transition-colors"
            />
            <div className="flex flex-wrap gap-2">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSort(opt.id)}
                  className={cn(
                    'text-xs font-mono px-3 py-1.5 rounded-full border transition-colors',
                    sort === opt.id
                      ? 'bg-for-500/20 text-for-300 border-for-500/50'
                      : 'bg-surface-200 text-surface-500 border-surface-300 hover:bg-surface-300 hover:text-white',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Content ── */}
        {loading && <TagsSkeleton />}

        {!loading && error && (
          <div className="rounded-2xl bg-surface-100 border border-against-800/30 p-6 text-center">
            <p className="text-sm font-mono text-against-400 mb-3">{error}</p>
            <button
              onClick={load}
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && data && data.tags.length === 0 && (
          <EmptyState
            icon={<Hash className="h-8 w-8" />}
            title="No tag votes yet"
            description="Cast votes on topics to see how your positions map across civic tags."
            actions={[{ label: 'Browse topics', href: '/' }]}
          />
        )}

        {!loading && !error && filteredStats.length === 0 && data && data.tags.length > 0 && (
          <EmptyState
            icon={<Hash className="h-8 w-8" />}
            title="No tags match"
            description={`No tags found for "${search}".`}
          />

        )}

        {!loading && !error && filteredStats.length > 0 && (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredStats.map((stat, i) => (
                <TagCard key={stat.tag} stat={stat} rank={i} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* ── Footer links ── */}
        {!loading && !error && data && data.tags.length > 0 && (
          <div className="mt-8 pt-6 border-t border-surface-300 flex flex-wrap gap-4 text-xs font-mono text-surface-500">
            <Link href="/tags" className="hover:text-white transition-colors flex items-center gap-1">
              <BarChart2 className="h-3 w-3" /> Browse all tags
            </Link>
            <Link href="/tags/compare" className="hover:text-white transition-colors flex items-center gap-1">
              <Scale className="h-3 w-3" /> Compare tags
            </Link>
            <Link href="/tags/my-tags" className="hover:text-white transition-colors flex items-center gap-1">
              <Bell className="h-3 w-3" /> My tag feed
            </Link>
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
