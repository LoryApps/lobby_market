'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Compass, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { TopicHoverCard } from '@/components/ui/TopicHoverCard'
import type { TopicPreview } from '@/app/api/topics/[id]/preview/route'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RelatedTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

interface RelatedTopicsProps {
  topicId: string
  className?: string
}

// ─── Badge config ─────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RelatedSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-xl bg-surface-100 border border-surface-300 p-4"
        >
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <div className="flex items-center gap-2 pt-1">
              <Skeleton className="h-3 w-16 rounded-full" />
              <Skeleton className="h-1.5 w-20 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Single related topic card ─────────────────────────────────────────────────

function RelatedCard({ topic }: { topic: RelatedTopic }) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  // Build a TopicPreview-compatible object from the already-fetched data
  const preloaded: TopicPreview = {
    id: topic.id,
    statement: topic.statement,
    status: topic.status,
    category: topic.category,
    scope: 'Global',
    blue_pct: topic.blue_pct,
    total_votes: topic.total_votes,
    description: null,
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <TopicHoverCard
        topicId={topic.id}
        href={`/topic/${topic.id}`}
        preloaded={preloaded}
        className="block"
      >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'group flex items-start gap-3 rounded-xl',
          'bg-surface-100 border border-surface-300',
          'hover:border-surface-400 hover:bg-surface-200',
          'p-4 transition-colors block'
        )}
      >
        {/* Left vote-color accent */}
        <div
          className="mt-1 h-8 w-1 rounded-full flex-shrink-0 overflow-hidden"
          aria-hidden="true"
        >
          <div
            className="bg-for-500 rounded-t-full"
            style={{ height: `${forPct}%` }}
          />
          <div
            className="bg-against-500 rounded-b-full"
            style={{ height: `${againstPct}%` }}
          />
        </div>

        <div className="flex-1 min-w-0">
          {/* Statement */}
          <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
            {topic.statement}
          </p>

          {/* Meta row */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Badge
              variant={STATUS_VARIANT[topic.status] ?? 'proposed'}
              className="text-[10px] px-2 py-0.5"
            >
              {STATUS_LABEL[topic.status] ?? topic.status}
            </Badge>

            {topic.category && (
              <span className="text-[10px] font-mono uppercase tracking-wider text-surface-500">
                {topic.category}
              </span>
            )}

            {/* Inline vote bar */}
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[10px] font-mono text-for-400 tabular-nums">
                {forPct}%
              </span>
              <div
                className="h-1 w-16 rounded-full overflow-hidden bg-surface-300"
                aria-label={`${forPct}% for, ${againstPct}% against`}
              >
                <div
                  className="h-full bg-for-500 float-left"
                  style={{ width: `${forPct}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-against-400 tabular-nums">
                {againstPct}%
              </span>
            </div>
          </div>
        </div>
      </Link>
      </TopicHoverCard>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RelatedTopics({ topicId, className }: RelatedTopicsProps) {
  const [topics, setTopics] = useState<RelatedTopic[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(`/api/topics/${topicId}/related`)
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) {
          setTopics(data.topics ?? [])
        }
      } catch {
        // Silent failure — section simply won't render
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [topicId])

  // Don't render the section at all if there's nothing to show after load
  if (!loading && topics.length === 0) return null

  return (
    <section className={cn('space-y-3', className)} aria-label="Related topics">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-purple" aria-hidden="true" />
          <h2 className="text-sm font-mono font-semibold text-surface-600 uppercase tracking-wider">
            You might also debate
          </h2>
        </div>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
          aria-label="Browse more topics"
        >
          <Compass className="h-3 w-3" aria-hidden="true" />
          Browse more
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <RelatedSkeleton />
      ) : (
        <div className="space-y-2">
          {topics.map((t) => (
            <RelatedCard key={t.id} topic={t} />
          ))}
        </div>
      )}
    </section>
  )
}
