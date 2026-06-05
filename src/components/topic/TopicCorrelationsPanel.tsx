'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  GitCompare,
  Link2,
  ThumbsDown,
  ThumbsUp,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { CorrelatedTopic, TopicCorrelationsResponse } from '@/app/api/topics/[id]/correlations/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopicCorrelationsPanelProps {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────


// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CorrelationSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-start gap-3 p-3 rounded-xl border border-surface-300 bg-surface-100"
        >
          <Skeleton className="h-6 w-6 rounded-md flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-4/5 rounded" />
            <Skeleton className="h-2.5 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Correlation row ──────────────────────────────────────────────────────────

function CorrelationRow({ item }: { item: CorrelatedTopic }) {
  const isAligned = item.direction === 'aligned'
  const pct = Math.round(Math.abs(item.correlation) * 100)
  const forPct = Math.round(item.blue_pct)
  const againstPct = 100 - forPct

  return (
    <Link
      href={`/topic/${item.id}`}
      className={cn(
        'group flex items-start gap-3 p-3 rounded-xl border transition-all',
        'hover:bg-surface-200/50',
        isAligned
          ? 'border-for-500/20 bg-for-500/5 hover:border-for-500/35'
          : 'border-against-500/20 bg-against-500/5 hover:border-against-500/35',
      )}
    >
      {/* Direction icon */}
      <div
        className={cn(
          'flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg mt-0.5',
          isAligned
            ? 'bg-for-500/15 text-for-400'
            : 'bg-against-500/15 text-against-400',
        )}
      >
        {isAligned ? (
          <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Statement */}
        <p className="text-sm text-white leading-snug line-clamp-2 group-hover:text-for-200 transition-colors mb-1.5">
          {item.statement}
        </p>

        {/* Meta row */}
        <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1">
          <Badge
            variant={STATUS_VARIANT[item.status] ?? 'proposed'}
            className="text-[10px] px-1.5 py-0"
          >
            {STATUS_LABEL[item.status] ?? item.status}
          </Badge>

          {item.category && (
            <span className="text-[11px] font-mono text-surface-500">
              {item.category}
            </span>
          )}

          <span
            className={cn(
              'text-[11px] font-mono font-semibold',
              isAligned ? 'text-for-400' : 'text-against-400',
            )}
          >
            {pct}% {isAligned ? 'aligned' : 'opposed'}
          </span>

          <span className="flex items-center gap-0.5 text-[11px] font-mono text-surface-600">
            <Users className="h-2.5 w-2.5" aria-hidden />
            {item.shared_voters} shared
          </span>
        </div>

        {/* Mini vote bar */}
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-for-400 w-6 text-right tabular-nums">
            {forPct}%
          </span>
          <div className="flex-1 h-1 rounded-full overflow-hidden bg-surface-300 flex">
            <div
              className="h-full bg-for-500 rounded-l-full"
              style={{ width: `${forPct}%` }}
            />
            <div
              className="h-full bg-against-600 rounded-r-full"
              style={{ width: `${againstPct}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-against-400 w-6 tabular-nums">
            {againstPct}%
          </span>
        </div>
      </div>

      <ArrowUpRight
        className={cn(
          'flex-shrink-0 h-3.5 w-3.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity',
          isAligned ? 'text-for-400' : 'text-against-400',
        )}
        aria-hidden
      />
    </Link>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function TopicCorrelationsPanel({ topicId, className }: TopicCorrelationsPanelProps) {
  const [data, setData] = useState<TopicCorrelationsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/topics/${topicId}/correlations`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) {
          setData(d as TopicCorrelationsResponse | null)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [topicId])

  // Don't render if no data
  if (!loading && (!data || !data.has_data)) return null

  const alignedCount = data?.correlations.filter((c) => c.direction === 'aligned').length ?? 0
  const opposedCount = data?.correlations.filter((c) => c.direction === 'opposed').length ?? 0
  const PREVIEW_COUNT = 3

  const visible = expanded
    ? (data?.correlations ?? [])
    : (data?.correlations ?? []).slice(0, PREVIEW_COUNT)

  return (
    <div className={cn('mt-8', className)}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-2 mb-3 group"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <GitCompare className="h-4 w-4 text-purple" aria-hidden />
          <h3 className="text-sm font-semibold text-white">
            Ideological Correlations
          </h3>
          {data && (
            <div className="flex items-center gap-1.5 text-[11px] font-mono">
              {alignedCount > 0 && (
                <span className="text-for-400">{alignedCount} aligned</span>
              )}
              {alignedCount > 0 && opposedCount > 0 && (
                <span className="text-surface-600">·</span>
              )}
              {opposedCount > 0 && (
                <span className="text-against-400">{opposedCount} opposed</span>
              )}
            </div>
          )}
        </div>
        {data && data.correlations.length > PREVIEW_COUNT && (
          <span className="text-surface-500 group-hover:text-white transition-colors">
            {expanded ? (
              <ChevronUp className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden />
            )}
          </span>
        )}
      </button>

      <p className="text-[11px] font-mono text-surface-500 mb-3 leading-relaxed">
        Topics voters tend to agree or disagree on together — based on shared voting patterns.
      </p>

      {/* Content */}
      {loading ? (
        <CorrelationSkeleton />
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {visible.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ delay: i * 0.04 }}
              >
                <CorrelationRow item={item} />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Expand/collapse toggle */}
          {data && data.correlations.length > PREVIEW_COUNT && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className={cn(
                'w-full mt-1 py-2 rounded-xl border text-xs font-mono transition-colors',
                'border-surface-300 text-surface-500',
                'hover:border-surface-400 hover:text-white',
              )}
            >
              {expanded
                ? 'Show fewer'
                : `Show ${data.correlations.length - PREVIEW_COUNT} more`}
            </button>
          )}

          {/* Link to full correlations atlas */}
          <div className="flex justify-end mt-2">
            <Link
              href="/correlations"
              className="inline-flex items-center gap-1 text-[11px] font-mono text-purple hover:text-purple/80 transition-colors"
            >
              <Link2 className="h-3 w-3" aria-hidden />
              Correlations atlas →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
