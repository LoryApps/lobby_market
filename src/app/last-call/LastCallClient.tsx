'use client'

/**
 * /last-call — Last Call for Votes
 *
 * Topics in the Voting phase ordered by voting_ends_at ascending —
 * soonest to expire first. Surfaces the debates where a vote is
 * most time-sensitive and consequential.
 *
 * Distinct from:
 *   /closingin    — topics closest to the LAW threshold (by vote %)
 *   /countdown    — same time-ordering but legacy standalone page
 *   /near-law     — near-law threshold, not time-based
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TopicWithAuthor } from '@/lib/supabase/types'

// ─── Urgency tiers ─────────────────────────────────────────────────────────────

type UrgencyTier = 'critical' | 'urgent' | 'active'

function getUrgency(voting_ends_at: string): UrgencyTier {
  const ms = new Date(voting_ends_at).getTime() - Date.now()
  const h = ms / 3_600_000
  if (h < 6) return 'critical'
  if (h < 24) return 'urgent'
  return 'active'
}

const URGENCY_CONFIG: Record<UrgencyTier, {
  label: string
  pill: string
  border: string
  icon: typeof Clock
  animate: boolean
}> = {
  critical: {
    label: 'Critical',
    pill: 'bg-against-500/15 border-against-500/50 text-against-300',
    border: 'border-against-500/40 hover:border-against-500/70',
    icon: AlertTriangle,
    animate: true,
  },
  urgent: {
    label: 'Urgent',
    pill: 'bg-amber-500/15 border-amber-500/50 text-amber-300',
    border: 'border-amber-500/30 hover:border-amber-500/60',
    icon: Timer,
    animate: false,
  },
  active: {
    label: 'Closing',
    pill: 'bg-for-500/15 border-for-500/40 text-for-300',
    border: 'border-for-500/20 hover:border-for-500/40',
    icon: Clock,
    animate: false,
  },
}

function formatTimeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'Closed'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h === 0) return `${m}m left`
  if (h < 24) return `${h}h ${m}m left`
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh > 0 ? `${d}d ${rh}h left` : `${d}d left`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TopicSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
      </div>
      <div className="flex items-center gap-3 mt-2">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function LastCallCard({ topic, index }: { topic: TopicWithAuthor; index: number }) {
  if (!topic.voting_ends_at) return null
  const tier = getUrgency(topic.voting_ends_at)
  const cfg = URGENCY_CONFIG[tier]
  const Icon = cfg.icon
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.5) }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'block rounded-2xl bg-surface-100 border transition-all p-5 group',
          cfg.border
        )}
      >
        {/* Header row */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-mono font-semibold',
              cfg.pill,
              cfg.animate && 'animate-pulse'
            )}
          >
            <Icon className="h-3 w-3" />
            {cfg.label}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-200 border border-surface-400 text-xs font-mono text-surface-500">
            <Clock className="h-3 w-3" />
            {formatTimeLeft(topic.voting_ends_at)}
          </span>
          {topic.category && (
            <span className="text-xs text-surface-500 font-mono">
              {topic.category}
            </span>
          )}
        </div>

        {/* Statement */}
        <p className="text-sm font-semibold text-white leading-snug mb-4 group-hover:text-for-200 transition-colors line-clamp-3">
          {topic.statement}
        </p>

        {/* Vote bar */}
        <div className="mb-3">
          <div className="flex items-center gap-2 text-[11px] font-mono mb-1.5">
            <span className="text-for-400 flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" /> {forPct}%
            </span>
            <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
              <div className="h-full bg-for-500 rounded-l-full" style={{ width: `${forPct}%` }} />
            </div>
            <span className="text-against-400 flex items-center gap-1">
              {againstPct}% <ThumbsDown className="h-3 w-3" />
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[11px] text-surface-500 font-mono">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {(topic.total_votes ?? 0).toLocaleString()} votes
          </span>
          <span className="flex items-center gap-1.5 text-for-400 group-hover:text-for-300 transition-colors">
            Vote now <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface LastCallData {
  topics: TopicWithAuthor[]
  hasMore: boolean
}

export function LastCallClient() {
  const [data, setData] = useState<LastCallData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)

  const load = useCallback(async (off: number, append: boolean) => {
    if (off === 0) setLoading(true)
    else setLoadingMore(true)

    try {
      const res = await fetch(`/api/feed/lastcall?limit=20&offset=${off}`)
      if (!res.ok) return
      const json: LastCallData = await res.json()
      setData((prev) =>
        append && prev
          ? { topics: [...prev.topics, ...json.topics], hasMore: json.hasMore }
          : json
      )
      setOffset(off + json.topics.length)
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => { load(0, false) }, [load])

  const topics = data?.topics ?? []

  // Split into urgency tiers
  const critical = topics.filter((t) => t.voting_ends_at && getUrgency(t.voting_ends_at) === 'critical')
  const urgent   = topics.filter((t) => t.voting_ends_at && getUrgency(t.voting_ends_at) === 'urgent')
  const active   = topics.filter((t) => t.voting_ends_at && getUrgency(t.voting_ends_at) === 'active')

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-against-500/10 border border-against-500/30">
              <Timer className="h-4 w-4 text-against-400" />
            </div>
            <h1 className="text-xl font-bold text-white font-mono">Last Call</h1>
            {topics.length > 0 && (
              <span className="ml-auto text-xs font-mono text-against-400 bg-against-500/10 border border-against-500/30 px-2 py-0.5 rounded-full animate-pulse">
                {topics.length} closing
              </span>
            )}
          </div>
          <p className="text-xs text-surface-500 mt-1 pl-10">
            Civic debates in their final voting window — sorted by urgency. Vote while your voice still counts.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <TopicSkeleton key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {!loading && topics.length === 0 && (
          <EmptyState
            icon={Timer}
            title="No votes closing soon"
            description="No topics are in their final voting window right now. Check back as debates approach their deadlines."
          />
        )}

        {/* Critical tier */}
        {!loading && critical.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-3.5 w-3.5 text-against-400 animate-pulse" />
              <h2 className="text-xs font-mono font-semibold text-against-400 uppercase tracking-widest">
                Critical — Under 6 hours
              </h2>
            </div>
            <div className="space-y-3">
              {critical.map((t, i) => (
                <LastCallCard key={t.id} topic={t} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* Urgent tier */}
        {!loading && urgent.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Timer className="h-3.5 w-3.5 text-amber-400" />
              <h2 className="text-xs font-mono font-semibold text-amber-400 uppercase tracking-widest">
                Urgent — Under 24 hours
              </h2>
            </div>
            <div className="space-y-3">
              {urgent.map((t, i) => (
                <LastCallCard key={t.id} topic={t} index={critical.length + i} />
              ))}
            </div>
          </section>
        )}

        {/* Active tier */}
        {!loading && active.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-3.5 w-3.5 text-for-400" />
              <h2 className="text-xs font-mono font-semibold text-for-400 uppercase tracking-widest">
                Closing Soon
              </h2>
            </div>
            <div className="space-y-3">
              {active.map((t, i) => (
                <LastCallCard key={t.id} topic={t} index={critical.length + urgent.length + i} />
              ))}
            </div>
          </section>
        )}

        {/* Load more */}
        {!loading && data?.hasMore && (
          <div className="mt-4 text-center">
            <button
              onClick={() => load(offset, true)}
              disabled={loadingMore}
              className={cn(
                'px-5 py-2.5 rounded-xl text-sm font-mono font-semibold transition-all',
                'bg-surface-100 border border-surface-300 text-surface-500',
                'hover:bg-surface-200 hover:text-white hover:border-surface-400',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {loadingMore ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Loading…
                </span>
              ) : 'Load more'}
            </button>
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
