'use client'

/**
 * /tags/my-tags — My Tags Hub
 *
 * A personalised dashboard for all tags the user follows.
 * Shows activity at a glance: new topics, hot debates, law counts.
 * Distinct from /tags (global browser) and /watchlist (topic subs).
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BellOff,
  ChevronRight,
  Gavel,
  GitCompare,
  Hash,
  Network,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { TagFollowButton } from '@/components/ui/TagFollowButton'
import { cn } from '@/lib/utils/cn'
import type { TagDigestEntry, MyTagsDigestResponse } from '@/app/api/tags/my-digest/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function activityLevel(entry: TagDigestEntry): 'hot' | 'active' | 'quiet' {
  if (entry.active_count >= 3 || entry.recent_topics.length >= 3) return 'hot'
  if (entry.active_count >= 1 || entry.recent_topics.length >= 1) return 'active'
  return 'quiet'
}

const ACTIVITY_STYLES = {
  hot: {
    dot: 'bg-against-400',
    label: 'Hot',
    labelClass: 'text-against-300',
  },
  active: {
    dot: 'bg-for-400',
    label: 'Active',
    labelClass: 'text-for-300',
  },
  quiet: {
    dot: 'bg-surface-500',
    label: 'Quiet',
    labelClass: 'text-surface-500',
  },
}

const STATUS_BADGE_VARIANT: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function TagCardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
      <div className="flex gap-4 mb-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-14 w-full rounded-xl" />
    </div>
  )
}

// ─── Tag Card ─────────────────────────────────────────────────────────────────

function TagCard({
  entry,
  onUnfollowed,
}: {
  entry: TagDigestEntry
  onUnfollowed: (tag: string) => void
}) {
  const level = activityLevel(entry)
  const styles = ACTIVITY_STYLES[level]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <Link
            href={`/tags/${encodeURIComponent(entry.tag)}`}
            className="flex items-center gap-2 group"
          >
            <Hash className="h-4 w-4 text-for-400 flex-shrink-0" />
            <span className="font-mono text-lg font-bold text-white group-hover:text-for-300 transition-colors">
              {entry.tag}
            </span>
          </Link>

          <TagFollowButton tag={entry.tag} onUnfollowed={() => onUnfollowed(entry.tag)} />
        </div>

        {/* Activity indicator + stats */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-surface-500">
          <span className="flex items-center gap-1.5">
            <span className={cn('h-1.5 w-1.5 rounded-full', styles.dot)} />
            <span className={styles.labelClass}>{styles.label}</span>
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {entry.topic_count.toLocaleString()} topic{entry.topic_count !== 1 ? 's' : ''}
          </span>
          {entry.law_count > 0 && (
            <span className="flex items-center gap-1 text-gold">
              <Gavel className="h-3 w-3" />
              {entry.law_count} law{entry.law_count !== 1 ? 's' : ''}
            </span>
          )}
          {entry.active_count > 0 && (
            <span className="flex items-center gap-1 text-for-300">
              <Zap className="h-3 w-3" />
              {entry.active_count} live
            </span>
          )}
          <span className="ml-auto text-surface-600">
            Followed {relativeTime(entry.followed_at)}
          </span>
        </div>
      </div>

      {/* New topics strip */}
      {entry.recent_topics.length > 0 && (
        <div className="border-t border-surface-300 bg-surface-200/40">
          <div className="px-5 py-2.5 flex items-center gap-2">
            <Sparkles className="h-3 w-3 text-for-400 flex-shrink-0" />
            <span className="text-[11px] font-mono font-semibold text-for-300 uppercase tracking-wider">
              New this week
            </span>
          </div>
          <div className="divide-y divide-surface-300/60">
            {entry.recent_topics.map((topic) => (
              <Link
                key={topic.id}
                href={`/topic/${topic.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-surface-300/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-white leading-snug line-clamp-1">
                    {topic.statement}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={STATUS_BADGE_VARIANT[topic.status] ?? 'proposed'} size="xs">
                    {topic.status.toUpperCase()}
                  </Badge>
                  <ChevronRight className="h-3 w-3 text-surface-500" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Top topic */}
      {entry.top_topic && entry.recent_topics.length === 0 && (
        <div className="border-t border-surface-300 bg-surface-200/40">
          <Link
            href={`/topic/${entry.top_topic.id}`}
            className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-300/40 transition-colors"
          >
            <BarChart2 className="h-4 w-4 text-surface-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono text-surface-500 mb-0.5">Top debate</p>
              <p className="text-xs font-mono text-white leading-snug line-clamp-1">
                {entry.top_topic.statement}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[11px] font-mono text-surface-500">
                {entry.top_topic.total_votes.toLocaleString()} votes
              </span>
              <ChevronRight className="h-3 w-3 text-surface-500" />
            </div>
          </Link>
        </div>
      )}

      {/* Footer link */}
      <div className="border-t border-surface-300/60 px-5 py-3 flex items-center justify-between">
        <Link
          href={`/tags/${encodeURIComponent(entry.tag)}`}
          className="flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
        >
          View all debates
          <ArrowRight className="h-3 w-3" />
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href={`/tags/compare?a=${encodeURIComponent(entry.tag)}`}
            className="text-[11px] font-mono text-surface-500 hover:text-surface-400 transition-colors flex items-center gap-1"
          >
            <GitCompare className="h-3 w-3" />
            Compare
          </Link>
          <Link
            href="/tags/graph"
            className="text-[11px] font-mono text-surface-500 hover:text-surface-400 transition-colors flex items-center gap-1"
          >
            <Network className="h-3 w-3" />
            Network
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyTagsPage() {
  const router = useRouter()
  const [tags, setTags] = useState<TagDigestEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    try {
      const res = await fetch('/api/tags/my-digest')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load tag digest')
      const data: MyTagsDigestResponse = await res.json()
      setTags(data.tags)
      setTotal(data.total_followed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  function handleUnfollowed(tag: string) {
    setTags((prev) => prev.filter((t) => t.tag !== tag))
    setTotal((prev) => Math.max(0, prev - 1))
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/tags"
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors"
              aria-label="Back to tag browser"
            >
              <ArrowLeft className="h-4 w-4 text-surface-500" />
            </Link>
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
              <Hash className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">My Tags</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {loading
                  ? 'Loading…'
                  : total > 0
                  ? `${total} followed tag${total !== 1 ? 's' : ''} · activity at a glance`
                  : 'No tags followed yet'}
              </p>
            </div>

            {!loading && tags.length > 0 && (
              <button
                onClick={() => load(true)}
                disabled={refreshing}
                aria-label="Refresh tag digest"
                className="ml-auto flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn('h-4 w-4 text-surface-500', refreshing && 'animate-spin')} />
              </button>
            )}
          </div>

          {/* Quick links */}
          {!loading && tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Link
                href="/tags"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-xs font-mono text-surface-500 hover:text-surface-400 transition-colors"
              >
                <TrendingUp className="h-3 w-3" />
                Explore all tags
              </Link>
              <Link
                href="/tags/graph"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-xs font-mono text-surface-500 hover:text-surface-400 transition-colors"
              >
                <Network className="h-3 w-3" />
                Tag network
              </Link>
              <Link
                href="/tags/compare"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-xs font-mono text-surface-500 hover:text-surface-400 transition-colors"
              >
                <GitCompare className="h-3 w-3" />
                Compare tags
              </Link>
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <TagCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/5 p-6 text-center">
            <p className="text-sm font-mono text-against-300">{error}</p>
            <button
              onClick={() => { setError(null); setLoading(true); load() }}
              className="mt-3 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              Try again
            </button>
          </div>
        ) : tags.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title="No tags followed yet"
            description="Follow tags from the tag browser or any topic page to build your personalised feed."
            action={
              <Link
                href="/tags"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
              >
                <Hash className="h-4 w-4" />
                Browse tags
              </Link>
            }
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-4">
              {tags.map((entry) => (
                <TagCard
                  key={entry.tag}
                  entry={entry}
                  onUnfollowed={handleUnfollowed}
                />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Discover more tags CTA */}
        {!loading && tags.length > 0 && (
          <div className="mt-8 rounded-2xl border border-surface-300 bg-surface-100 p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-mono font-semibold text-white">
                Discover more tags
              </p>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Find topics in areas you haven&apos;t explored yet.
              </p>
            </div>
            <Link
              href="/tags"
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 hover:bg-for-500 text-white text-xs font-mono font-semibold transition-colors"
            >
              Explore
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
