'use client'

/**
 * /profile/[username]/tags — Civic Tag Subscriptions
 *
 * Shows the civic topic tags a citizen follows — their curated lens on the
 * policy landscape. Each tag card shows the topic count, follower count,
 * and how many topics in this tag they've voted on.
 *
 * Viewers can follow/unfollow the same tags directly from this page.
 *
 * Distinct from:
 *   /tags                    — platform-wide tag browser
 *   /tag/[tag]               — single tag topic feed
 *   /analytics/tags          — personal tag engagement analytics
 *   /profile/[username]/votes — topics voted on (no tag filter)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Bell,
  BellOff,
  ChevronRight,
  Hash,
  Loader2,
  RefreshCw,
  Tag,
  Users,
  Vote,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { ProfileTagsResponse, ProfileTag } from '@/app/api/profile/[username]/tags/route'

// ─── Category-derived colors for tags ─────────────────────────────────────────

const TAG_PALETTE = [
  'bg-for-500/10 text-for-300 border-for-500/20',
  'bg-against-500/10 text-against-300 border-against-500/20',
  'bg-purple/10 text-purple border-purple/20',
  'bg-gold/10 text-gold border-gold/20',
  'bg-emerald/10 text-emerald border-emerald/20',
]

function tagColor(tag: string): string {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) | 0
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length]
}

// ─── Relative time ─────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const m = Math.floor(d / 30)
  const y = Math.floor(d / 365)
  if (d < 1) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  if (m < 12) return `${m}mo ago`
  return `${y}y ago`
}

// ─── Sort options ──────────────────────────────────────────────────────────────

type SortMode = 'followed_at' | 'topic_count' | 'follower_count' | 'user_votes'

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'followed_at',   label: 'Recently Followed' },
  { id: 'topic_count',   label: 'Most Topics' },
  { id: 'follower_count', label: 'Most Popular' },
  { id: 'user_votes',    label: 'Most Voted' },
]

function sortTags(tags: ProfileTag[], mode: SortMode): ProfileTag[] {
  return [...tags].sort((a, b) => {
    if (mode === 'followed_at')    return new Date(b.followed_at).getTime() - new Date(a.followed_at).getTime()
    if (mode === 'topic_count')    return b.topic_count - a.topic_count
    if (mode === 'follower_count') return b.follower_count - a.follower_count
    if (mode === 'user_votes')     return b.user_vote_count - a.user_vote_count
    return 0
  })
}

// ─── Tag card ──────────────────────────────────────────────────────────────────

function TagCard({
  tag,
  isOwn,
  onFollowToggle,
  toggling,
}: {
  tag: ProfileTag
  isOwn: boolean
  onFollowToggle: (tag: string, currentlyFollowing: boolean) => void
  toggling: string | null
}) {
  const colors = tagColor(tag.tag)
  const isBusy = toggling === tag.tag

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-4 hover:border-surface-400 transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* Tag pill */}
        <Link
          href={`/tag/${encodeURIComponent(tag.tag)}`}
          className="flex-1 min-w-0"
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
                colors
              )}
            >
              <Hash className="h-2.5 w-2.5" aria-hidden="true" />
              {tag.tag}
            </span>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 text-xs text-surface-500">
            <span className="flex items-center gap-1">
              <Tag className="h-3 w-3" aria-hidden="true" />
              <span>{tag.topic_count.toLocaleString()} topic{tag.topic_count !== 1 ? 's' : ''}</span>
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden="true" />
              <span>{tag.follower_count.toLocaleString()} follower{tag.follower_count !== 1 ? 's' : ''}</span>
            </span>
            {tag.user_vote_count > 0 && (
              <span className="flex items-center gap-1 text-for-400">
                <Vote className="h-3 w-3" aria-hidden="true" />
                <span>{tag.user_vote_count} voted</span>
              </span>
            )}
          </div>

          {/* Progress bar: user coverage */}
          {tag.topic_count > 0 && (
            <div className="mt-2">
              <div className="h-1 w-full bg-surface-300 rounded-full overflow-hidden">
                <div
                  className="h-full bg-for-500/60 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (tag.user_vote_count / tag.topic_count) * 100)}%` }}
                  aria-label={`Voted on ${tag.user_vote_count} of ${tag.topic_count} topics`}
                />
              </div>
              <p className="text-[10px] text-surface-600 mt-0.5">
                Voted on {tag.user_vote_count} of {tag.topic_count} topics
              </p>
            </div>
          )}

          <p className="text-[11px] text-surface-600 mt-1.5">
            Followed {relTime(tag.followed_at)}
          </p>
        </Link>

        {/* Follow / unfollow button — show for others viewing the profile */}
        {!isOwn && (
          <button
            onClick={() => onFollowToggle(tag.tag, tag.viewer_is_following)}
            disabled={isBusy}
            aria-label={tag.viewer_is_following ? `Unfollow #${tag.tag}` : `Follow #${tag.tag}`}
            className={cn(
              'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              tag.viewer_is_following
                ? 'bg-surface-300 text-surface-600 hover:bg-against-500/20 hover:text-against-300'
                : 'bg-for-600 text-white hover:bg-for-700',
              isBusy && 'opacity-50 pointer-events-none'
            )}
          >
            {isBusy ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : tag.viewer_is_following ? (
              <BellOff className="h-3 w-3" aria-hidden="true" />
            ) : (
              <Bell className="h-3 w-3" aria-hidden="true" />
            )}
            {tag.viewer_is_following ? 'Following' : 'Follow'}
          </button>
        )}

        {/* External link for own profile */}
        {isOwn && (
          <Link
            href={`/tag/${encodeURIComponent(tag.tag)}`}
            className="flex-shrink-0 p-1.5 rounded-lg text-surface-500 hover:text-surface-700 hover:bg-surface-200 transition-colors"
            aria-label={`Browse #${tag.tag} topics`}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </motion.div>
  )
}

// ─── Skeleton loading ──────────────────────────────────────────────────────────

function TagsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-1 w-full rounded-full" />
        </div>
      ))}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ProfileTagsPage() {
  const { username } = useParams<{ username: string }>()
  const [data, setData] = useState<ProfileTagsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortMode>('followed_at')
  const [toggling, setToggling] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/profile/${username}/tags`)
      if (!res.ok) throw new Error('Failed to load tags')
      const json = await res.json() as ProfileTagsResponse
      setData(json)
    } catch {
      setError('Could not load tag follows. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [username])

  useEffect(() => { load() }, [load])

  async function handleFollowToggle(tag: string, currentlyFollowing: boolean) {
    if (toggling) return
    setToggling(tag)
    try {
      const res = currentlyFollowing
        ? await fetch(`/api/tags/follow?tag=${encodeURIComponent(tag)}`, { method: 'DELETE' })
        : await fetch('/api/tags/follow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag }),
          })
      if (!res.ok) throw new Error('Failed to update follow')
      // Optimistically update state
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          tags: prev.tags.map((t) =>
            t.tag === tag
              ? {
                  ...t,
                  viewer_is_following: !currentlyFollowing,
                  follower_count: t.follower_count + (currentlyFollowing ? -1 : 1),
                }
              : t
          ),
        }
      })
    } catch {
      // Silent fail — UI stays consistent on next load
    } finally {
      setToggling(null)
    }
  }

  const profile = data?.profile
  const tags = data ? sortTags(data.tags, sort) : []
  const stats = data?.stats
  const isOwn = data?.is_own_profile ?? false

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12" id="main-content">

        {/* Back navigation */}
        <div className="mb-5">
          <Link
            href={`/profile/${username}`}
            className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 transition-colors"
            aria-label={`Back to ${username}'s profile`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to profile
          </Link>
        </div>

        {/* Header */}
        {profile && (
          <div className="flex items-center gap-3 mb-6">
            <Avatar
              src={profile.avatar_url}
              fallback={profile.display_name ?? profile.username}
              size="md"
            />
            <div>
              <h1 className="text-lg font-semibold text-surface-700">
                {profile.display_name ?? profile.username}
                <span className="text-surface-500 font-normal text-sm ml-1">@{profile.username}</span>
              </h1>
              <p className="text-sm text-surface-500 flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5" aria-hidden="true" />
                Civic tag subscriptions
              </p>
            </div>
          </div>
        )}

        {/* Stats bar */}
        {stats && stats.total_followed > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Tags Following', value: stats.total_followed, icon: Hash },
              { label: 'Topics Covered', value: stats.total_topics_covered, icon: Tag },
              { label: 'Topics Voted', value: stats.total_votes_via_tags, icon: Vote },
            ].map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-3 text-center"
              >
                <Icon className="h-4 w-4 text-surface-500 mx-auto mb-1" aria-hidden="true" />
                <p className="text-lg font-bold text-surface-700">{value.toLocaleString()}</p>
                <p className="text-[10px] text-surface-500 leading-tight">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Sort controls */}
        {!loading && tags.length > 1 && (
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
            <BarChart2 className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" aria-hidden="true" />
            <div className="flex items-center gap-1.5" role="group" aria-label="Sort options">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSort(opt.id)}
                  aria-pressed={sort === opt.id}
                  className={cn(
                    'flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                    sort === opt.id
                      ? 'bg-for-600 text-white'
                      : 'bg-surface-200 text-surface-500 hover:bg-surface-300'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <TagsSkeleton />
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 text-center space-y-3">
            <p className="text-sm text-surface-500">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-200 text-surface-600 text-xs hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Retry
            </button>
          </div>
        ) : tags.length === 0 ? (
          <EmptyState
            icon={Hash}
            title={isOwn ? "You're not following any tags yet" : `${profile?.display_name ?? username} hasn't followed any tags`}
            description={
              isOwn
                ? 'Follow topic tags to curate your civic feed and stay informed on issues you care about.'
                : 'When they follow civic tags, their subscriptions will appear here.'
            }
            actions={isOwn ? [{ label: 'Browse tags', href: '/tags' }] : undefined}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={sort}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
              role="list"
              aria-label={`Tags followed by ${username}`}
            >
              {tags.map((tag) => (
                <div key={tag.tag} role="listitem">
                  <TagCard
                    tag={tag}
                    isOwn={isOwn}
                    onFollowToggle={handleFollowToggle}
                    toggling={toggling}
                  />
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Discover more tags CTA */}
        {!loading && tags.length > 0 && (
          <div className="mt-6 text-center">
            <Link
              href="/tags"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 text-surface-600 text-sm hover:bg-surface-300 transition-colors"
            >
              <Hash className="h-3.5 w-3.5" aria-hidden="true" />
              Browse all civic tags
            </Link>
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
