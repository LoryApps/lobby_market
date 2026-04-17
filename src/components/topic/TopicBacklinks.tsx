'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight, Network } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { TopicBacklinksResponse, TopicLinkEntry } from '@/app/api/topics/[id]/backlinks/route'

// ─── Status config ─────────────────────────────��──────────────────────────────

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

// ─── Single link card ───────────────────────────��─────────────────────────────

function LinkCard({
  topic,
  direction,
}: {
  topic: TopicLinkEntry
  direction: 'in' | 'out'
}) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'block rounded-xl border bg-surface-200/50 p-3.5 transition-all group',
        direction === 'in'
          ? 'border-surface-300 hover:border-for-500/50 hover:bg-for-500/5'
          : 'border-surface-300 hover:border-purple/50 hover:bg-purple/5'
      )}
    >
      <p
        className={cn(
          'text-[13px] font-medium leading-snug line-clamp-2 transition-colors',
          direction === 'in'
            ? 'text-white group-hover:text-for-300'
            : 'text-white group-hover:text-purple'
        )}
      >
        {topic.statement}
      </p>

      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <Badge
          variant={STATUS_VARIANT[topic.status] ?? 'proposed'}
        >
          {STATUS_LABEL[topic.status] ?? topic.status}
        </Badge>

        {topic.category && (
          <span className="text-[10px] font-mono text-surface-500">
            {topic.category}
          </span>
        )}

        {topic.total_votes > 0 && (
          <span className="ml-auto flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-mono text-for-400 tabular-nums">
              {forPct}%
            </span>
            <span
              className="h-1 w-12 rounded-full bg-surface-300 overflow-hidden"
              role="meter"
              aria-label={`${forPct}% for, ${againstPct}% against`}
              aria-valuenow={forPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span
                className="h-full bg-for-500 float-left transition-all"
                style={{ width: `${forPct}%` }}
              />
            </span>
            <span className="text-[10px] font-mono text-against-400 tabular-nums">
              {againstPct}%
            </span>
          </span>
        )}
      </div>
    </Link>
  )
}

// ─── Section ──────────────────────────��────────────────────────────────���──────

function Section({
  title,
  icon,
  items,
  direction,
  emptyText,
}: {
  title: string
  icon: React.ReactNode
  items: TopicLinkEntry[]
  direction: 'in' | 'out'
  emptyText: string
}) {
  return (
    <div>
      <header className="flex items-center gap-2 mb-3">
        <span className="text-surface-500">{icon}</span>
        <h3 className="text-[11px] uppercase tracking-widest text-surface-500 font-mono font-semibold">
          {title}
        </h3>
        {items.length > 0 && (
          <span className="ml-auto text-[10px] font-mono text-surface-500 bg-surface-200 px-1.5 py-0.5 rounded">
            {items.length}
          </span>
        )}
      </header>

      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((t) => (
            <LinkCard key={t.id} topic={t} direction={direction} />
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-surface-500 italic font-mono px-1 pb-1">
          {emptyText}
        </p>
      )}
    </div>
  )
}

// ─── Skeleton ────────────���────────────────────────────────────────────────────

function LinksSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-surface-300 bg-surface-200/50 p-3.5 space-y-2"
        >
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  )
}

// ─── Main export ─────────────────────────────────���────────────────────────────

interface TopicBacklinksProps {
  topicId: string
  className?: string
}

export function TopicBacklinks({ topicId, className }: TopicBacklinksProps) {
  const [data, setData] = useState<TopicBacklinksResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/topics/${topicId}/backlinks`)
      .then((r) => r.json())
      .then((d: TopicBacklinksResponse) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setData({ cited_by: [], cites: [] })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [topicId])

  // Don't render the panel if there are no links at all (once loaded)
  if (!loading && data && data.cited_by.length === 0 && data.cites.length === 0) {
    return null
  }

  const hasData = data && (data.cited_by.length > 0 || data.cites.length > 0)

  return (
    <div
      className={cn(
        'rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-5',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Network className="h-4 w-4 text-surface-500" />
        <h2 className="text-[11px] uppercase tracking-widest text-surface-500 font-mono font-semibold">
          Wiki Link Graph
        </h2>
      </div>

      {loading ? (
        <>
          <LinksSkeleton />
          <div className="border-t border-surface-300 pt-5">
            <LinksSkeleton />
          </div>
        </>
      ) : hasData ? (
        <>
          <Section
            title="Cited By"
            icon={<ArrowDownLeft className="h-3.5 w-3.5" />}
            items={data.cited_by}
            direction="in"
            emptyText="No other topics link here yet."
          />

          {data.cited_by.length > 0 && data.cites.length > 0 && (
            <div className="border-t border-surface-300" />
          )}

          <Section
            title="Cites"
            icon={<ArrowUpRight className="h-3.5 w-3.5" />}
            items={data.cites}
            direction="out"
            emptyText="This topic doesn't link to others yet."
          />
        </>
      ) : null}
    </div>
  )
}
