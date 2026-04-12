'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useFeedStore } from '@/lib/stores/feed-store'
import { TopicCard } from '@/components/feed/TopicCard'
import { FeedTutorial } from '@/components/feed/FeedTutorial'

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

export function FeedContainer() {
  const { topics, isLoading, hasMore, fetchNextPage } = useFeedStore()
  const sentinelRef = useRef<HTMLDivElement>(null)

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

  return (
    <div className="feed-scroll">
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

      {/* Empty state */}
      {!isLoading && topics.length === 0 && (
        <div className="feed-card flex items-center justify-center">
          <div className="text-center px-6">
            <p className="text-2xl font-bold text-white mb-2">No topics yet</p>
            <p className="text-surface-500">
              Be the first to propose a topic for the lobby.
            </p>
          </div>
        </div>
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
  )
}
