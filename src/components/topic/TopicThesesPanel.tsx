'use client'

/**
 * TopicThesesPanel
 *
 * Surfaces every civic thesis staked on this topic. Bridges two independent
 * primitives: a topic (binary claim under vote) and a civic thesis (dated,
 * falsifiable prediction). When a user stakes a thesis with related_topic_id
 * set, it should be visible from the topic page too — otherwise the linkage
 * is one-directional and users on the topic page never learn who has bet
 * their reputation on the outcome.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Scroll,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { Thesis, ThesisListResponse, ThesisStatus } from '@/lib/types/thesis'

interface TopicThesesPanelProps {
  topicId: string
  className?: string
}

const PREVIEW_COUNT = 3
const MAX_COUNT = 10

const STATUS_META: Record<
  ThesisStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  active: {
    label: 'Active',
    icon: Sparkles,
    className: 'bg-for-500/10 border-for-500/30 text-for-300',
  },
  vindicated: {
    label: 'Vindicated',
    icon: CheckCircle2,
    className: 'bg-emerald/10 border-emerald/30 text-emerald',
  },
  refuted: {
    label: 'Refuted',
    icon: XCircle,
    className: 'bg-against-500/10 border-against-500/30 text-against-300',
  },
  expired: {
    label: 'Expired',
    icon: Clock,
    className: 'bg-surface-300/40 border-surface-300 text-surface-500',
  },
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const d = Math.round(diff / 86_400_000)
  if (d < 0) return 'past'
  if (d === 0) return 'today'
  if (d === 1) return 'in 1 day'
  if (d < 30) return `in ${d} days`
  const months = Math.round(d / 30)
  if (months < 12) return `in ${months}mo`
  const years = Math.round(months / 12)
  return `in ${years}y`
}

function ThesisRow({ thesis }: { thesis: Thesis }) {
  const status = STATUS_META[thesis.status]
  const StatusIcon = status.icon
  const total = thesis.agree_count + thesis.disagree_count
  const agreePct = total > 0 ? Math.round((thesis.agree_count / total) * 100) : 50

  return (
    <Link
      href={`/thesis/${thesis.id}`}
      className={cn(
        'block rounded-xl border border-surface-300 bg-surface-200/50 p-3.5',
        'transition-all group hover:border-gold/40 hover:bg-gold/5',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="pt-0.5 shrink-0">
          <Avatar
            src={thesis.author?.avatar_url ?? null}
            name={thesis.author?.display_name ?? thesis.author?.username ?? 'Anonymous'}
            size="sm"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[11px] font-mono font-semibold text-white truncate">
              {thesis.author?.display_name ?? thesis.author?.username ?? 'Anonymous'}
            </span>
            <span className="text-[10px] font-mono text-surface-500">
              · {relativeTime(thesis.created_at)}
            </span>
            <span
              className={cn(
                'ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold border',
                status.className,
              )}
            >
              <StatusIcon className="h-2.5 w-2.5" />
              {status.label}
            </span>
          </div>

          <p className="text-[13px] leading-snug text-white group-hover:text-gold transition-colors line-clamp-3">
            {thesis.statement}
          </p>

          <div className="mt-2 flex items-center gap-3 flex-wrap">
            {total > 0 ? (
              <span className="flex items-center gap-1.5">
                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald tabular-nums">
                  <ThumbsUp className="h-2.5 w-2.5" />
                  {thesis.agree_count}
                </span>
                <span
                  className="h-1 w-14 rounded-full bg-surface-300 overflow-hidden"
                  role="meter"
                  aria-label={`${agreePct}% agree`}
                  aria-valuenow={agreePct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span
                    className="block h-full bg-emerald transition-all"
                    style={{ width: `${agreePct}%` }}
                  />
                </span>
                <span className="flex items-center gap-1 text-[10px] font-mono text-against-400 tabular-nums">
                  <ThumbsDown className="h-2.5 w-2.5" />
                  {thesis.disagree_count}
                </span>
              </span>
            ) : (
              <span className="text-[10px] font-mono text-surface-500">
                No votes yet
              </span>
            )}

            {thesis.resolution_date && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
                <Clock className="h-2.5 w-2.5" />
                Resolves {daysUntil(thesis.resolution_date)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-surface-300 bg-surface-200/40 p-3.5"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function TopicThesesPanel({ topicId, className }: TopicThesesPanelProps) {
  const [theses, setTheses] = useState<Thesis[] | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      // Fetch across all statuses so we surface vindicated/refuted history too.
      const [activeRes, resolvedRes] = await Promise.all([
        fetch(
          `/api/thesis?topic_id=${encodeURIComponent(topicId)}&status=active&sort=popular&limit=${MAX_COUNT}`,
          { cache: 'no-store' },
        ),
        fetch(
          `/api/thesis?topic_id=${encodeURIComponent(topicId)}&status=vindicated&sort=newest&limit=${MAX_COUNT}`,
          { cache: 'no-store' },
        ),
      ])

      if (!activeRes.ok || !resolvedRes.ok) {
        setError(true)
        return
      }

      const active: ThesisListResponse = await activeRes.json()
      const resolved: ThesisListResponse = await resolvedRes.json()
      const merged = [...active.theses, ...resolved.theses]

      const seen = new Set<string>()
      const deduped: Thesis[] = []
      for (const t of merged) {
        if (seen.has(t.id)) continue
        seen.add(t.id)
        deduped.push(t)
        if (deduped.length >= MAX_COUNT) break
      }

      setTheses(deduped)
      setTotal(active.total + resolved.total)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => {
    load()
  }, [load])

  const visible = expanded ? theses ?? [] : (theses ?? []).slice(0, PREVIEW_COUNT)
  const hiddenCount = (theses?.length ?? 0) - PREVIEW_COUNT

  return (
    <section
      className={cn(
        'rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/[0.04] to-surface-200/60 p-4 sm:p-5',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gold/10 border border-gold/30 shrink-0">
            <Scroll className="h-4 w-4 text-gold" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white font-mono truncate">
              Staked Theses
            </h3>
            <p className="text-[11px] text-surface-500 truncate">
              Predictions others made on this topic
            </p>
          </div>
        </div>

        <Link
          href={`/thesis/create?topic=${encodeURIComponent(topicId)}`}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold shrink-0',
            'bg-gold/10 border border-gold/40 text-gold hover:bg-gold/20 transition-colors',
          )}
        >
          <Scroll className="h-3 w-3" />
          Stake yours
        </Link>
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="rounded-xl border border-against-500/30 bg-against-500/5 p-3 text-[12px] text-against-300 font-mono">
          Couldn&apos;t load theses for this topic.
        </div>
      ) : !theses || theses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-300 bg-surface-100/40 p-5 text-center">
          <p className="text-[12px] text-surface-400 mb-2.5 leading-relaxed">
            No civic theses staked on this topic yet.
            <br />
            Be the first to make a dated, falsifiable prediction.
          </p>
          <Link
            href={`/thesis/create?topic=${encodeURIComponent(topicId)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold bg-gold/10 border border-gold/40 text-gold hover:bg-gold/20 transition-colors"
          >
            <Sparkles className="h-3 w-3" />
            Stake the first thesis
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {visible.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                <ThesisRow thesis={t} />
              </motion.div>
            ))}
          </AnimatePresence>

          {(theses?.length ?? 0) > PREVIEW_COUNT && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-mono font-semibold text-surface-400 hover:text-white hover:bg-surface-300/30 transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Show fewer
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show {hiddenCount} more
                </>
              )}
            </button>
          )}

          {total > MAX_COUNT && (
            <div className="text-center pt-1">
              <span className="text-[10px] font-mono text-surface-500">
                {total} theses total on this topic
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
