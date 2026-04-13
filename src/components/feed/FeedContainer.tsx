'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import Link from 'next/link'
import { Users, Search, Keyboard, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFeedStore } from '@/lib/stores/feed-store'
import { useVoteStore } from '@/lib/stores/vote-store'
import { TopicCard } from '@/components/feed/TopicCard'
import { FeedTutorial } from '@/components/feed/FeedTutorial'
import { FeedFilters } from '@/components/feed/FeedFilters'
import { cn } from '@/lib/utils/cn'

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

// ─── Keyboard shortcuts help overlay ─────────────────────────────────────────

const SHORTCUTS = [
  { keys: ['j', '↓'], action: 'Next topic' },
  { keys: ['k', '↑'], action: 'Previous topic' },
  { keys: ['f', '→'], action: 'Vote FOR' },
  { keys: ['a', '←'], action: 'Vote AGAINST' },
  { keys: ['Enter'], action: 'Open topic detail' },
  { keys: ['?'], action: 'Toggle this help' },
]

function KeyboardHelpOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') onClose()
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[9990] flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-xs rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-300">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-for-400" aria-hidden="true" />
            <span className="text-sm font-mono font-semibold text-white">Keyboard Shortcuts</span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center h-6 w-6 rounded-md text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <ul className="py-3 px-5 space-y-2.5">
          {SHORTCUTS.map(({ keys, action }) => (
            <li key={action} className="flex items-center justify-between gap-4">
              <span className="text-sm text-surface-500">{action}</span>
              <div className="flex items-center gap-1 flex-shrink-0">
                {keys.map((k, i) => (
                  <span key={k} className="flex items-center gap-1">
                    {i > 0 && <span className="text-surface-600 text-xs">/</span>}
                    <kbd className="inline-flex items-center justify-center min-w-[1.75rem] h-6 px-1.5 rounded-md bg-surface-200 border border-surface-400 text-[11px] font-mono text-surface-300">
                      {k}
                    </kbd>
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <div className="px-5 pb-4 pt-1">
          <p className="text-[11px] text-surface-600 font-mono">
            Shortcuts are disabled when a text field is focused.
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function FeedContainer() {
  const { topics, isLoading, hasMore, feedMode, followingCount, fetchNextPage, updateTopic } = useFeedStore()
  const { castVote } = useVoteStore()
  const [showHelp, setShowHelp] = useState(false)
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

      // ? toggles help regardless of most focus states
      if (e.key === '?' && !inInput) {
        e.preventDefault()
        setShowHelp((v) => !v)
        return
      }

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
          <FeedFilters />
        </div>
      </div>

      {/* Keyboard shortcut hint — desktop only */}
      <button
        onClick={() => setShowHelp(true)}
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

      {/* Keyboard shortcuts help overlay */}
      <AnimatePresence>
        {showHelp && (
          <KeyboardHelpOverlay onClose={() => setShowHelp(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
