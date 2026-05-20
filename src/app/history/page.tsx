'use client'

/**
 * /history — Recently Viewed Topics
 *
 * Reads the last 30 topic IDs from localStorage (recorded whenever a user
 * visits a topic detail page) and renders them as a chronological list.
 * Fully client-side — no authentication required, no server data.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ChevronRight,
  Clock,
  Gavel,
  History,
  RefreshCw,
  Scale,
  Trash2,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import {
  getRecentlyViewed,
  clearRecentlyViewed,
  type RecentlyViewedEntry,
} from '@/lib/utils/recently-viewed'
import type { BatchTopic, BatchTopicsResponse } from '@/app/api/topics/batch/route'

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
  if (d < 30) return `${d}d ago`
  const months = Math.floor(d / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
  continued: 'Continued',
}

const STATUS_BADGE_VARIANT: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
  continued: 'active',
}

const STATUS_DOT: Record<string, string> = {
  proposed: 'bg-surface-500',
  active: 'bg-emerald',
  voting: 'bg-purple',
  law: 'bg-gold',
  failed: 'bg-against-500',
  continued: 'bg-for-400',
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-for-300',
  Philosophy: 'text-purple',
  Culture: 'text-against-400',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-gold',
}

// ─── Topic Row ────────────────────────────────────────────────────────────────

function TopicRow({
  topic,
  viewedAt,
  index,
}: {
  topic: BatchTopic
  viewedAt: string
  index: number
}) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const statusVariant = STATUS_BADGE_VARIANT[topic.status] ?? 'proposed'
  const dotClass = STATUS_DOT[topic.status] ?? 'bg-surface-500'
  const catColor = CATEGORY_COLORS[topic.category ?? ''] ?? 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'group block rounded-2xl border border-surface-300/80 bg-surface-100',
          'hover:border-surface-400/80 hover:bg-surface-200/60',
          'transition-colors duration-150'
        )}
      >
        <div className="flex items-start gap-3 p-4">
          {/* Status dot */}
          <div className="mt-1 flex-shrink-0">
            <span className={cn('block h-2.5 w-2.5 rounded-full', dotClass)} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Statement */}
            <p className="text-sm font-mono font-medium text-white leading-snug line-clamp-2 mb-2 group-hover:text-for-300 transition-colors">
              {topic.statement}
            </p>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-2.5">
              <Badge variant={statusVariant} className="text-[10px] px-1.5 py-0.5">
                {topic.status === 'law' && <Gavel className="h-2.5 w-2.5 mr-1" aria-hidden="true" />}
                {topic.status === 'voting' && <Scale className="h-2.5 w-2.5 mr-1" aria-hidden="true" />}
                {topic.status === 'active' && <Zap className="h-2.5 w-2.5 mr-1" aria-hidden="true" />}
                {STATUS_LABEL[topic.status] ?? topic.status}
              </Badge>

              {topic.category && (
                <span className={cn('text-[10px] font-mono font-medium', catColor)}>
                  {topic.category}
                </span>
              )}

              <span className="text-[10px] font-mono text-surface-500">
                {topic.total_votes.toLocaleString()} votes
              </span>

              <span className="flex items-center gap-1 text-[10px] font-mono text-surface-600">
                <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                {relativeTime(viewedAt)}
              </span>
            </div>

            {/* Vote bar */}
            <div
              className="relative h-1 w-full rounded-full overflow-hidden bg-surface-300"
              role="img"
              aria-label={`${forPct}% for, ${againstPct}% against`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-700 to-for-500 rounded-l-full"
                style={{ width: `${forPct}%` }}
                aria-hidden="true"
              />
              <div
                className="absolute inset-y-0 right-0 bg-gradient-to-r from-against-400 to-against-600 rounded-r-full"
                style={{ width: `${againstPct}%` }}
                aria-hidden="true"
              />
            </div>

            <div className="flex justify-between mt-1">
              <span className="text-[10px] font-mono text-for-400">{forPct}% For</span>
              <span className="text-[10px] font-mono text-against-400">{againstPct}% Against</span>
            </div>
          </div>

          {/* Chevron */}
          <ChevronRight
            className="h-4 w-4 text-surface-500 flex-shrink-0 mt-1 group-hover:text-white transition-colors"
            aria-hidden="true"
          />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 p-4 rounded-2xl bg-surface-100 border border-surface-300/80">
      <Skeleton className="h-2.5 w-2.5 rounded-full mt-1 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-4 w-20 rounded-full" />
        </div>
        <Skeleton className="h-1 w-full rounded-full" />
      </div>
      <Skeleton className="h-4 w-4 flex-shrink-0 rounded mt-1" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [entries, setEntries] = useState<RecentlyViewedEntry[]>([])
  const [topics, setTopics] = useState<BatchTopic[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [cleared, setCleared] = useState(false)

  const load = useCallback(async () => {
    const stored = getRecentlyViewed()
    setEntries(stored)

    if (stored.length === 0) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/topics/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: stored.map((e) => e.id) }),
      })
      if (res.ok) {
        const data = (await res.json()) as BatchTopicsResponse
        setTopics(data.topics)
      }
    } catch {
      // best-effort — show empty state on error
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function handleClear() {
    clearRecentlyViewed()
    setEntries([])
    setTopics([])
    setCleared(true)
  }

  // Map topic IDs to their viewed_at timestamp
  const viewedAtMap = new Map(entries.map((e) => [e.id, e.viewed_at]))

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-28 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
              <History className="h-5 w-5 text-for-400" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Recently Viewed
              </h1>
              {!isLoading && (
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  {topics.length > 0
                    ? `${topics.length} topic${topics.length === 1 ? '' : 's'} visited`
                    : 'No topics visited yet'}
                </p>
              )}
            </div>
          </div>

          {topics.length > 0 && (
            <button
              onClick={handleClear}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono',
                'border border-surface-400/40 text-surface-500',
                'hover:border-against-500/40 hover:text-against-400',
                'transition-colors duration-150'
              )}
              aria-label="Clear browsing history"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </button>
          )}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </motion.div>
          ) : topics.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <EmptyState
                icon={History}
                iconColor="text-for-400"
                iconBg="bg-for-500/10"
                iconBorder="border-for-500/30"
                title={cleared ? 'History cleared' : 'No topics visited yet'}
                description={
                  cleared
                    ? 'Your viewing history has been removed from this device.'
                    : 'Topics you open will appear here so you can pick up where you left off.'
                }
                actions={[
                  {
                    label: 'Browse the feed',
                    href: '/',
                    icon: ArrowRight,
                  },
                ]}
              />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              {topics.map((topic, index) => (
                <TopicRow
                  key={topic.id}
                  topic={topic}
                  viewedAt={viewedAtMap.get(topic.id) ?? topic.created_at}
                  index={index}
                />
              ))}

              {/* Separator + Browse CTA */}
              <div className="pt-4 border-t border-surface-300">
                <Link
                  href="/"
                  className={cn(
                    'flex items-center justify-center gap-2 w-full py-3 rounded-xl',
                    'border border-surface-300 bg-surface-100',
                    'hover:border-surface-400 hover:bg-surface-200',
                    'text-sm font-mono font-medium text-surface-500 hover:text-white',
                    'transition-colors duration-150'
                  )}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Browse all topics
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
