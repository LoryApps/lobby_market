'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import Link from 'next/link'
import { Users, Search, Keyboard, RefreshCw, ChevronUp, Sparkles, UserPlus, Check, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFeedStore } from '@/lib/stores/feed-store'
import { useVoteStore } from '@/lib/stores/vote-store'
import { subscribeToFeed } from '@/lib/supabase/realtime'
import { openKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts'
import { TopicCard } from '@/components/feed/TopicCard'
import { FeedTutorial } from '@/components/feed/FeedTutorial'
import { DailyQuorumNudge } from '@/components/feed/DailyQuorumNudge'
import { FeedInsightStrip } from '@/components/feed/FeedInsightStrip'
import { FeedFilters } from '@/components/feed/FeedFilters'
import { PulseDot } from '@/components/simulation/PulseDot'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type { TopicWithAuthor } from '@/lib/supabase/types'

// ─── Suggested user types ─────────────────────────────────────────────────────

interface SuggestedFeedUser {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  bio: string | null
}

function SuggestedUserRow({ user }: { user: SuggestedFeedUser }) {
  const [following, setFollowing] = useState(false)
  const [busy, setBusy] = useState(false)

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      await fetch('/api/follow', {
        method: following ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: user.id }),
      })
      setFollowing((f) => !f)
    } catch {
      // best-effort
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors">
      <Link href={`/profile/${user.username}`} className="flex items-center gap-2.5 flex-1 min-w-0">
        <Avatar src={user.avatar_url} fallback={user.display_name || user.username} size="sm" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white truncate">
            {user.display_name || user.username}
          </p>
          <p className="text-[11px] text-surface-500 truncate">@{user.username}</p>
        </div>
      </Link>
      <button
        onClick={toggle}
        disabled={busy}
        aria-label={following ? `Unfollow @${user.username}` : `Follow @${user.username}`}
        className={cn(
          'flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold',
          'border transition-all disabled:opacity-50',
          following
            ? 'bg-for-600/20 border-for-600/40 text-for-400'
            : 'bg-purple/80 border-purple/50 text-white hover:bg-purple'
        )}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : following ? <Check className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
        {following ? 'Following' : 'Follow'}
      </button>
    </div>
  )
}

function SuggestedPeoplePanel() {
  const [people, setPeople] = useState<SuggestedFeedUser[]>([])

  useEffect(() => {
    fetch('/api/users/suggestions?limit=5')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.suggestions) setPeople(d.suggestions as SuggestedFeedUser[]) })
      .catch(() => {})
  }, [])

  if (people.length === 0) return null

  return (
    <div className="w-full max-w-xs mt-6">
      <p className="text-[11px] font-mono font-semibold text-surface-500 uppercase tracking-wider mb-2 text-center">
        Suggested to follow
      </p>
      <div className="space-y-1.5">
        {people.map((u) => (
          <SuggestedUserRow key={u.id} user={u} />
        ))}
      </div>
      <Link
        href="/search?tab=people"
        className="mt-3 block text-center text-[11px] font-mono text-purple hover:text-purple/80 transition-colors"
      >
        Find more people →
      </Link>
    </div>
  )
}

function FeedSkeleton() {
  return (
    <div className="feed-card flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-lg bg-surface-100 border border-surface-300 rounded-2xl p-6 animate-pulse min-h-[70dvh] flex flex-col">
        {/* Top badges */}
        <div className="flex justify-between mb-6">
          <div className="h-5 w-20 bg-surface-300 rounded-full" />
          <div className="h-5 w-16 bg-surface-300 rounded-full" />
        </div>
        {/* Statement placeholder */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-4">
          <div className="h-7 w-4/5 bg-surface-300 rounded" />
          <div className="h-7 w-3/5 bg-surface-300 rounded" />
          <div className="h-7 w-2/5 bg-surface-300 rounded" />
        </div>
        {/* Vote bar placeholder */}
        <div className="mt-auto space-y-4">
          <div className="h-3 w-full bg-surface-300 rounded-full" />
          <div className="flex gap-3">
            <div className="flex-1 h-12 bg-surface-300 rounded-xl" />
            <div className="flex-1 h-12 bg-surface-300 rounded-xl" />
          </div>
          {/* Author row */}
          <div className="flex items-center gap-2 pt-2 border-t border-surface-300">
            <div className="h-8 w-8 bg-surface-300 rounded-full" />
            <div className="h-4 w-24 bg-surface-300 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}

function FollowingEmptyState({ followingCount }: { followingCount: number }) {
  if (followingCount === 0) {
    // User isn't following anyone — show suggestions
    return (
      <div className="feed-card flex items-center justify-center py-8">
        <div className="flex flex-col items-center px-6 max-w-sm w-full">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-purple/10 border border-purple/30 mb-4">
            <Users className="h-7 w-7 text-purple" />
          </div>
          <h2 className="text-xl font-bold text-white font-mono mb-2 text-center">
            Nobody followed yet
          </h2>
          <p className="text-sm text-surface-500 leading-relaxed mb-2 text-center">
            Follow people to see the topics they propose — your own curated stream.
          </p>
          <SuggestedPeoplePanel />
        </div>
      </div>
    )
  }

  // User follows people but they have no topics
  return (
    <div className="feed-card flex items-center justify-center">
      <div className="text-center px-8 max-w-xs">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-surface-200 border border-surface-300 mx-auto mb-5">
          <Users className="h-7 w-7 text-surface-500" />
        </div>
        <h2 className="text-xl font-bold text-white font-mono mb-2">
          Nothing yet
        </h2>
        <p className="text-sm text-surface-500 leading-relaxed mb-6">
          The {followingCount} {followingCount === 1 ? 'person' : 'people'} you follow
          {' '}haven&apos;t proposed any topics yet. Check back soon.
        </p>
        <Link
          href="/search?tab=people"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300 hover:bg-surface-300 text-white text-sm font-mono font-medium transition-colors"
        >
          <Search className="h-4 w-4" />
          Find more people
        </Link>
      </div>
    </div>
  )
}

// ─── For You empty states ─────────────────────────────────────────────────────

function ForYouEmptyState({ hasPreferences }: { hasPreferences: boolean }) {
  if (!hasPreferences) {
    // User hasn't completed the calibration quiz
    return (
      <div className="feed-card flex items-center justify-center">
        <div className="text-center px-8 max-w-xs">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-gold/10 border border-gold/30 mx-auto mb-5">
            <Sparkles className="h-7 w-7 text-gold" />
          </div>
          <h2 className="text-xl font-bold text-white font-mono mb-2">
            Calibrate your feed
          </h2>
          <p className="text-sm text-surface-500 leading-relaxed mb-6">
            Take the 5-question calibration quiz to unlock a feed tuned to your
            political and intellectual interests.
          </p>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold/80 hover:bg-gold text-surface-50 text-sm font-mono font-medium transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Start calibration
          </Link>
        </div>
      </div>
    )
  }

  // User has preferences but no topics matched (rare — categories might not have topics yet)
  return (
    <div className="feed-card flex items-center justify-center">
      <div className="text-center px-8 max-w-xs">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-surface-200 border border-surface-300 mx-auto mb-5">
          <Sparkles className="h-7 w-7 text-surface-500" />
        </div>
        <h2 className="text-xl font-bold text-white font-mono mb-2">
          All caught up
        </h2>
        <p className="text-sm text-surface-500 leading-relaxed mb-6">
          No new topics in your preferred categories right now. Explore the full
          feed or broaden your calibration.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/"
            onClick={() => {}}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-medium transition-colors"
          >
            Explore all topics
          </Link>
          <Link
            href="/onboarding"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300 hover:bg-surface-300 text-white text-sm font-mono font-medium transition-colors"
          >
            Recalibrate
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Keyboard shortcuts help overlay ─────────────────────────────────────────


// ─── End-of-feed rich state ───────────────────────────────────────────────────

function EndOfFeed({
  topicCount,
  pendingCount,
  onShowNew,
  onScrollTop,
}: {
  topicCount: number
  pendingCount: number
  onShowNew: () => void
  onScrollTop: () => void
}) {
  return (
    <div className="feed-card flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center space-y-6">
        {/* Divider mark */}
        <div className="flex items-center justify-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-for-500/40 to-transparent" />
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-for-600/20 border border-for-500/30">
            <span className="font-mono text-xs font-bold text-for-400">∎</span>
          </div>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-against-500/40 to-transparent" />
        </div>

        {/* Copy */}
        <div className="space-y-2">
          <p className="font-mono text-lg font-bold text-white">
            You&apos;re all caught up
          </p>
          <p className="text-sm text-surface-500 leading-relaxed">
            {topicCount === 1
              ? 'You reviewed 1 topic in this session.'
              : `You reviewed ${topicCount.toLocaleString()} topics in this session.`}{' '}
            New debates land every hour.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={onShowNew}
              className={cn(
                'flex items-center justify-center gap-2 w-full py-2.5 rounded-xl',
                'bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-medium',
                'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-for-400/50',
              )}
            >
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
              {pendingCount === 1 ? 'See 1 new topic' : `See ${pendingCount} new topics`}
            </button>
          )}
          <button
            type="button"
            onClick={onScrollTop}
            className={cn(
              'flex items-center justify-center gap-2 w-full py-2.5 rounded-xl',
              'bg-surface-200 border border-surface-300 hover:bg-surface-300',
              'text-white text-sm font-mono font-medium',
              'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-surface-400/50',
            )}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Back to top
          </button>
          <div className="flex gap-2">
            <Link
              href="/pulse"
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl',
                'bg-gold/10 border border-gold/30 hover:bg-gold/20',
                'text-gold text-xs font-mono font-medium',
                'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40',
              )}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Community Pulse
            </Link>
            <Link
              href="/topic/categories"
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl',
                'bg-surface-200/60 border border-surface-300/60 hover:bg-surface-200',
                'text-surface-500 hover:text-white text-xs font-mono font-medium',
                'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-surface-400/50',
              )}
            >
              Browse categories
            </Link>
            <Link
              href="/search"
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl',
                'bg-surface-200/60 border border-surface-300/60 hover:bg-surface-200',
                'text-surface-500 hover:text-white text-xs font-mono font-medium',
                'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-surface-400/50',
              )}
            >
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              Search
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main feed container ──────────────────────────────────────────────────────

export function FeedContainer() {
  const { topics, isLoading, hasMore, feedMode, followingCount, hasPreferences, fetchNextPage, updateTopic, prependTopic } = useFeedStore()
  const { castVote } = useVoteStore()
  const [pendingNew, setPendingNew] = useState<TopicWithAuthor[]>([])
  const [isLive, setIsLive] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Initial fetch
  useEffect(() => {
    if (topics.length === 0) {
      fetchNextPage()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime: subscribe to feed INSERT + UPDATE events ─────────────────────
  useEffect(() => {
    let mounted = true

    const channel = subscribeToFeed(
      // onInsert — queue new topics; don't auto-scroll the user away
      (newTopic) => {
        if (!mounted) return
        const { statusFilter, categoryFilter, scopeFilter, feedMode: mode, preferredCategories } = useFeedStore.getState()
        if (mode === 'following') return
        // For You mode: only queue topics that match the user's preferred categories
        if (mode === 'foryou') {
          if (!newTopic.category || !preferredCategories.includes(newTopic.category)) return
        }
        if (!['proposed', 'active', 'voting', 'law'].includes(newTopic.status)) return
        if (statusFilter && newTopic.status !== statusFilter) return
        if (categoryFilter && newTopic.category !== categoryFilter) return
        if (scopeFilter && newTopic.scope !== scopeFilter) return
        setPendingNew((prev) => {
          // De-dupe in case of double delivery
          if (prev.some((t) => t.id === newTopic.id)) return prev
          // Realtime topics don't carry author data — null is safe; TopicCard falls back gracefully
          return [{ ...newTopic, author: null }, ...prev]
        })
      },
      // onUpdate — apply vote-count changes immediately; AnimatedNumber handles smoothing
      (updatedTopic) => {
        if (!mounted) return
        useFeedStore.getState().updateTopic(updatedTopic.id, updatedTopic)
      },
    )

    setIsLive(true)

    return () => {
      mounted = false
      setIsLive(false)
      channel.unsubscribe()
    }
  }, [])

  // ── Show pending new topics: prepend + scroll to top ──────────────────────
  function showPendingTopics() {
    if (pendingNew.length === 0) return
    // Prepend in reverse so the most-recent ends up first
    for (const t of [...pendingNew].reverse()) {
      prependTopic(t)
    }
    setPendingNew([])
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // IntersectionObserver for infinite scroll
  const observerCallback = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries
      if (entry.isIntersecting && hasMore && !isLoading) {
        fetchNextPage()
      }
    },
    [hasMore, isLoading, fetchNextPage]
  )

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(observerCallback, {
      root: null,
      rootMargin: '200px',
      threshold: 0,
    })

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [observerCallback])

  // Keyboard shortcuts:
  //   j / ↓    → next topic
  //   k / ↑    → previous topic
  //   f / →    → vote FOR on visible topic
  //   a / ←    → vote AGAINST on visible topic
  //   Enter    → open visible topic detail
  //   ?        → toggle keyboard help overlay
  useEffect(() => {
    async function handleKeyDown(e: KeyboardEvent) {
      const el = scrollRef.current
      if (!el) return

      const tag = (document.activeElement?.tagName ?? '').toLowerCase()
      const inInput = ['input', 'textarea', 'select'].includes(tag)

      if (inInput || ['button', 'a'].includes(tag)) return

      const cardHeight = window.innerHeight

      // Navigation
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault()
        el.scrollBy({ top: cardHeight, behavior: 'smooth' })
        return
      }
      if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        el.scrollBy({ top: -cardHeight, behavior: 'smooth' })
        return
      }

      // Voting
      if (e.key === 'f' || e.key === 'ArrowRight' || e.key === 'a' || e.key === 'ArrowLeft') {
        e.preventDefault()
        const side = (e.key === 'f' || e.key === 'ArrowRight') ? 'blue' : 'red'
        const currentTopics = useFeedStore.getState().topics
        const index = Math.round(el.scrollTop / cardHeight)
        const topic = currentTopics[index]
        if (!topic) return
        if (topic.status !== 'active' && topic.status !== 'voting') return
        if (useVoteStore.getState().hasVoted(topic.id)) return
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(40)
        }
        const isBlue = side === 'blue'
        await castVote(topic.id, side as 'blue' | 'red')
        updateTopic(topic.id, {
          total_votes: topic.total_votes + 1,
          blue_votes: topic.blue_votes + (isBlue ? 1 : 0),
          red_votes: topic.red_votes + (isBlue ? 0 : 1),
          blue_pct: ((topic.blue_votes + (isBlue ? 1 : 0)) / (topic.total_votes + 1)) * 100,
        })
        return
      }

      // Open topic detail
      if (e.key === 'Enter') {
        e.preventDefault()
        const currentTopics = useFeedStore.getState().topics
        const index = Math.round(el.scrollTop / cardHeight)
        const topic = currentTopics[index]
        if (topic) window.location.href = `/topic/${topic.id}`
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [castVote, updateTopic])

  return (
    <div className="relative">
      {/* Filter bar — floats below the TopBar (h-14 = top-14) over the feed */}
      <div className="fixed top-14 left-0 right-0 z-40 pointer-events-none">
        <div className="pointer-events-auto bg-gradient-to-b from-surface-50/95 via-surface-50/70 to-transparent pb-2">
          {/* LIVE indicator — shown when the realtime channel is open */}
          <AnimatePresence>
            {isLive && (
              <motion.div
                key="live-badge"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className="flex items-center justify-end px-3 pt-1.5 pb-0.5"
                aria-live="polite"
                aria-label="Feed is live"
              >
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-200/60 border border-surface-300/50 backdrop-blur-sm">
                  <PulseDot color="green" className="h-2 w-2" />
                  <span className="text-[10px] font-mono font-semibold text-emerald tracking-wider uppercase">
                    Live
                  </span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          <FeedFilters />
        </div>
      </div>

      {/* "New topics" floating banner — appears when realtime queues new arrivals */}
      <AnimatePresence>
        {pendingNew.length > 0 && (
          <motion.div
            key="new-topics-banner"
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="fixed z-50 top-[calc(3.5rem+var(--filter-h,5rem))] left-1/2 -translate-x-1/2"
          >
            <button
              type="button"
              onClick={showPendingTopics}
              className={cn(
                'flex items-center gap-2 pl-3 pr-4 py-2 rounded-full shadow-lg',
                'bg-for-600 hover:bg-for-500 text-white',
                'text-xs font-mono font-semibold',
                'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-for-400/50',
              )}
              aria-label={`${pendingNew.length} new ${pendingNew.length === 1 ? 'topic' : 'topics'} — tap to view`}
            >
              <ChevronUp className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              {pendingNew.length === 1
                ? '1 new topic'
                : `${pendingNew.length} new topics`}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard shortcut hint — desktop only */}
      <button
        onClick={openKeyboardShortcuts}
        title="Keyboard shortcuts (?)"
        aria-label="Show keyboard shortcuts"
        className={cn(
          'fixed bottom-6 right-4 z-50 hidden md:flex',
          'items-center gap-1.5 h-8 px-2.5 rounded-lg',
          'bg-surface-200/80 border border-surface-400/60 backdrop-blur-sm',
          'text-xs font-mono text-surface-500 hover:text-white hover:bg-surface-300',
          'transition-colors'
        )}
      >
        <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
        <kbd className="text-[10px]">?</kbd>
      </button>

      <div ref={scrollRef} className="feed-scroll" aria-label="Topic feed">
        <FeedTutorial />
        <DailyQuorumNudge />
        {topics.map((topic, index) => (
          <div key={topic.id}>
            <TopicCard
              topic={topic}
              authorName={topic.author?.display_name ?? topic.author?.username ?? undefined}
              authorAvatar={topic.author?.avatar_url ?? undefined}
            />
            {/* Inject a live-stats strip after every 8th topic */}
            {(index + 1) % 8 === 0 && (
              <FeedInsightStrip groupIndex={Math.floor(index / 8) + 1} />
            )}
          </div>
        ))}

        {/* Loading skeletons */}
        {isLoading && (
          <>
            <FeedSkeleton />
            <FeedSkeleton />
          </>
        )}

        {/* Empty state: discover feed */}
        {!isLoading && topics.length === 0 && feedMode === 'discover' && (
          <div className="feed-card flex items-center justify-center">
            <div className="text-center px-6">
              <p className="text-2xl font-bold text-white mb-2">No topics yet</p>
              <p className="text-surface-500">
                Be the first to propose a topic for the lobby.
              </p>
            </div>
          </div>
        )}

        {/* Empty state: following feed */}
        {!isLoading && topics.length === 0 && feedMode === 'following' && (
          <FollowingEmptyState followingCount={followingCount} />
        )}

        {/* Empty state: for you feed */}
        {!isLoading && topics.length === 0 && feedMode === 'foryou' && (
          <ForYouEmptyState hasPreferences={hasPreferences} />
        )}

        {/* Sentinel for infinite scroll */}
        {hasMore && <div ref={sentinelRef} className="h-1" />}

        {/* End of feed */}
        {!hasMore && topics.length > 0 && (
          <EndOfFeed
            topicCount={topics.length}
            pendingCount={pendingNew.length}
            onShowNew={showPendingTopics}
            onScrollTop={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          />
        )}
      </div>

    </div>
  )
}
