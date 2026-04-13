'use client'

import { useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Users, Search } from 'lucide-react'
import { useFeedStore } from '@/lib/stores/feed-store'
import { TopicCard } from '@/components/feed/TopicCard'
import { FeedTutorial } from '@/components/feed/FeedTutorial'
import { FeedFilters } from '@/components/feed/FeedFilters'

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
    // User isn't following anyone
    return (
      <div className="feed-card flex items-center justify-center">
        <div className="text-center px-8 max-w-xs">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-purple/10 border border-purple/30 mx-auto mb-5">
            <Users className="h-7 w-7 text-purple" />
          </div>
          <h2 className="text-xl font-bold text-white font-mono mb-2">
            Nobody followed yet
          </h2>
          <p className="text-sm text-surface-500 leading-relaxed mb-6">
            Follow people to see the topics they propose here — your own curated stream.
          </p>
          <Link
            href="/search?tab=people"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple/80 hover:bg-purple text-white text-sm font-mono font-medium transition-colors"
          >
            <Search className="h-4 w-4" />
            Find people to follow
          </Link>
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

export function FeedContainer() {
  const { topics, isLoading, hasMore, feedMode, followingCount, fetchNextPage } = useFeedStore()
  const sentinelRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Initial fetch
  useEffect(() => {
    if (topics.length === 0) {
      fetchNextPage()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Keyboard navigation: ArrowDown/j scrolls to the next snap card,
  // ArrowUp/k scrolls to the previous one. Ignored when an interactive
  // element has focus so normal keyboard use isn't disrupted.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const el = scrollRef.current
      if (!el) return
      const tag = (document.activeElement?.tagName ?? '').toLowerCase()
      if (['input', 'textarea', 'button', 'select', 'a'].includes(tag)) return

      const cardHeight = window.innerHeight
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault()
        el.scrollBy({ top: cardHeight, behavior: 'smooth' })
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        el.scrollBy({ top: -cardHeight, behavior: 'smooth' })
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="relative">
      {/* Filter bar — floats below the TopBar (h-14 = top-14) over the feed */}
      <div className="fixed top-14 left-0 right-0 z-40 pointer-events-none">
        <div className="pointer-events-auto bg-gradient-to-b from-surface-50/95 via-surface-50/70 to-transparent pb-2">
          <FeedFilters />
        </div>
      </div>

      <div ref={scrollRef} className="feed-scroll" aria-label="Topic feed">
        <FeedTutorial />
        {topics.map((topic) => (
          <TopicCard key={topic.id} topic={topic} />
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

        {/* Sentinel for infinite scroll */}
        {hasMore && <div ref={sentinelRef} className="h-1" />}

        {/* End of feed */}
        {!hasMore && topics.length > 0 && (
          <div className="flex items-center justify-center py-10 text-surface-500 text-sm">
            You have reached the end of the feed.
          </div>
        )}
      </div>
    </div>
  )
}
