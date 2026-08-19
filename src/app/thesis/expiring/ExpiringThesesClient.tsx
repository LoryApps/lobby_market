'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  CircleDot,
  Clock,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ExpiringThesisEntry, ExpiringThesesResponse } from '@/app/api/thesis/expiring/route'

// ─── Config ───────────────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  economics: 'text-gold border-gold/40 bg-gold/10',
  politics: 'text-for-400 border-for-500/40 bg-for-500/10',
  technology: 'text-purple border-purple/40 bg-purple/10',
  science: 'text-emerald border-emerald/40 bg-emerald/10',
  ethics: 'text-against-400 border-against-500/40 bg-against-500/10',
  philosophy: 'text-surface-400 border-surface-400/40 bg-surface-300/20',
  culture: 'text-pink-400 border-pink-500/40 bg-pink-500/10',
  health: 'text-green-400 border-green-500/40 bg-green-500/10',
  environment: 'text-teal-400 border-teal-500/40 bg-teal-500/10',
  education: 'text-indigo-400 border-indigo-500/40 bg-indigo-500/10',
}

// ─── Countdown display ────────────────────────────────────────────────────────

function CountdownBadge({ entry }: { entry: ExpiringThesisEntry }) {
  const urgent = entry.hours_to_resolve <= 24
  const critical = entry.hours_to_resolve <= 6

  if (critical) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-against-400">
        <AlertTriangle className="h-3 w-3" />
        {entry.hours_to_resolve}h left
      </span>
    )
  }
  if (urgent) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-against-400">
        <Clock className="h-3 w-3" />
        {entry.hours_to_resolve}h left
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-mono font-semibold text-purple">
      <Timer className="h-3 w-3" />
      {entry.days_to_resolve}d left
    </span>
  )
}

// ─── Urgency label ────────────────────────────────────────────────────────────

function urgencyLabel(hours: number): string {
  if (hours <= 6) return 'Critical'
  if (hours <= 24) return 'Today'
  if (hours <= 48) return 'Tomorrow'
  return `${Math.ceil(hours / 24)}d`
}

// ─── Thesis Card ──────────────────────────────────────────────────────────────

function ExpiringCard({ entry, index }: { entry: ExpiringThesisEntry; index: number }) {
  const catColor = CAT_COLORS[entry.category] ?? 'text-surface-400 border-surface-400/40 bg-surface-300/20'
  const total = entry.total_engagement
  const agreeWidth = total > 0 ? Math.round((entry.agree_count / total) * 100) : 50
  const disagreeWidth = 100 - agreeWidth
  const critical = entry.hours_to_resolve <= 6
  const urgent = entry.hours_to_resolve <= 24

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
    >
      <Link href={`/thesis/${entry.id}`}>
        <div
          className={cn(
            'group flex flex-col gap-3 p-4 rounded-xl border transition-all cursor-pointer',
            critical
              ? 'bg-against-500/5 border-against-500/30 hover:border-against-500/50 hover:bg-against-500/10'
              : urgent
              ? 'bg-surface-100 border-against-500/20 hover:border-against-500/30 hover:bg-surface-150'
              : 'bg-surface-100 border-surface-300 hover:border-surface-400 hover:bg-surface-150'
          )}
        >
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {entry.author && (
                <Avatar
                  src={entry.author.avatar_url}
                  username={entry.author.username}
                  size={22}
                  className="flex-shrink-0"
                />
              )}
              <span className="text-[11px] font-mono text-surface-500 truncate">
                {entry.author?.display_name || entry.author?.username || 'Anonymous'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <CountdownBadge entry={entry} />
              <span
                className={cn(
                  'text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border capitalize',
                  catColor
                )}
              >
                {entry.category}
              </span>
            </div>
          </div>

          {/* Statement */}
          <p className="text-sm font-mono text-white leading-relaxed line-clamp-3 group-hover:text-surface-100 transition-colors">
            {entry.statement}
          </p>

          {/* Vote bar */}
          {total > 0 && (
            <div className="space-y-1">
              <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300">
                <div className="bg-for-500 transition-all" style={{ width: `${agreeWidth}%` }} />
                <div className="bg-against-500 transition-all" style={{ width: `${disagreeWidth}%` }} />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="flex items-center gap-1 text-for-400">
                  <ThumbsUp className="h-2.5 w-2.5" />
                  {entry.agree_count} agree ({agreeWidth}%)
                </span>
                <span className="flex items-center gap-1 text-against-400">
                  {entry.disagree_count} disagree ({disagreeWidth}%)
                  <ThumbsDown className="h-2.5 w-2.5" />
                </span>
              </div>
            </div>
          )}

          {/* Resolution date */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-surface-500">
              Resolves {new Date(entry.resolution_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            <span className="text-[10px] font-mono text-surface-500">
              {total} vote{total !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Urgency group ────────────────────────────────────────────────────────────

function UrgencyGroup({
  label,
  color,
  entries,
  index,
}: {
  label: string
  color: string
  entries: ExpiringThesisEntry[]
  index: number
}) {
  if (entries.length === 0) return null
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.1 }}
      className="space-y-2"
    >
      <div className={cn('text-[11px] font-mono font-bold uppercase tracking-widest', color)}>
        {label}
      </div>
      <div className="space-y-2">
        {entries.map((e, i) => (
          <ExpiringCard key={e.id} entry={e} index={i} />
        ))}
      </div>
    </motion.section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ExpiringThesesClient() {
  const [data, setData] = useState<ExpiringThesesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/thesis/expiring')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      })
      .then((d: ExpiringThesesResponse) => setData(d))
      .catch(() => setError('Could not load expiring theses — try refreshing.'))
      .finally(() => setLoading(false))
  }, [])

  const entries = data?.entries ?? []

  // Group by urgency
  const critical = entries.filter((e) => e.hours_to_resolve <= 6)
  const today = entries.filter((e) => e.hours_to_resolve > 6 && e.hours_to_resolve <= 24)
  const thisWeek = entries.filter((e) => e.hours_to_resolve > 24)

  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      <TopBar />

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-against-500/20 border border-against-500/30 flex items-center justify-center flex-shrink-0">
              <Timer className="h-4.5 w-4.5 text-against-400" />
            </div>
            <div>
              <h1 className="text-base font-mono font-bold text-white">Expiring Soon</h1>
              <p className="text-[11px] font-mono text-surface-500">
                Active theses resolving in the next 7 days
              </p>
            </div>
          </div>

          {!loading && !error && entries.length > 0 && (
            <p className="text-[11px] font-mono text-surface-500">
              {entries.length} thesis{entries.length !== 1 ? 'es' : ''} closing —
              cast your vote before the deadline.
            </p>
          )}
        </motion.div>

        {/* Content */}
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <EmptyState message={error} />
        ) : entries.length === 0 ? (
          <EmptyState
            message="No theses expiring in the next 7 days. Check back soon or browse all active theses."
          />
        ) : (
          <div className="space-y-6">
            <UrgencyGroup
              label="Critical — closing today"
              color="text-against-400"
              entries={critical}
              index={0}
            />
            <UrgencyGroup
              label="Closing today"
              color="text-against-300"
              entries={today}
              index={1}
            />
            <UrgencyGroup
              label="This week"
              color="text-purple"
              entries={thisWeek}
              index={2}
            />
          </div>
        )}

        {/* Footer links */}
        {!loading && !error && (
          <div className="pt-2 pb-4 flex items-center justify-center gap-4 text-[11px] font-mono text-surface-500">
            <Link href="/thesis" className="hover:text-white transition-colors flex items-center gap-1">
              <CircleDot className="h-3 w-3" />
              Browse all theses
            </Link>
            <span className="text-surface-600">·</span>
            <Link href="/thesis/hot" className="hover:text-white transition-colors flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Hot takes
            </Link>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
