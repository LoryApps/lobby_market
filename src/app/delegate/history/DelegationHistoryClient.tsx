'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Filter,
  Globe,
  History,
  RefreshCw,
  Scale,
  SplitSquareHorizontal,
  Tag,
  ThumbsDown,
  ThumbsUp,
  UserCheck,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { DelegationHistoryResponse, DelegateVoteEntry } from '@/app/api/delegation/history/route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function scopeLabel(entry: DelegateVoteEntry): string {
  if (entry.scope === 'topic') return 'topic'
  if (entry.scope === 'category') return entry.category ?? 'category'
  return 'global'
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  sub,
  colorClass,
}: {
  label: string
  value: string | number
  sub?: string
  colorClass?: string
}) {
  return (
    <div className="flex-1 min-w-0 rounded-xl border border-surface-200 bg-surface-100 p-4">
      <div className={cn('text-2xl font-bold font-mono', colorClass ?? 'text-white')}>{value}</div>
      <div className="text-xs font-mono text-surface-500 mt-0.5 uppercase tracking-wide">{label}</div>
      {sub && <div className="text-xs text-surface-600 mt-1">{sub}</div>}
    </div>
  )
}

// ─── Vote card ────────────────────────────────────────────────────────────────

function VoteCard({ entry }: { entry: DelegateVoteEntry }) {
  const isFor = entry.delegate_side === 'for'
  const sideColor = isFor ? 'text-for-400' : 'text-against-400'
  const sideBg = isFor ? 'bg-for-500/10 border-for-500/30' : 'bg-against-500/10 border-against-500/30'
  const SideIcon = isFor ? ThumbsUp : ThumbsDown

  const statusColors: Record<string, string> = {
    proposed: 'text-surface-400 bg-surface-200/50',
    active: 'text-for-300 bg-for-500/10',
    voting: 'text-purple bg-purple/10',
    law: 'text-gold bg-gold/10',
    failed: 'text-against-400 bg-against-500/10',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border bg-surface-100 overflow-hidden',
        entry.is_override
          ? 'border-surface-300'
          : 'border-surface-200',
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3 border-b border-surface-200">
        <Avatar
          src={entry.delegate_avatar_url}
          name={entry.delegate_display_name ?? entry.delegate_username}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/profile/${entry.delegate_username}`}
              className="text-sm font-semibold text-white hover:text-for-300 transition-colors truncate"
            >
              {entry.delegate_display_name ?? entry.delegate_username}
            </Link>
            <span className="text-xs text-surface-500">voted</span>
            <span className={cn('text-xs font-bold font-mono uppercase tracking-wide', sideColor)}>
              {entry.delegate_side}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {/* Scope badge */}
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-500">
              {entry.scope === 'global' && <Globe className="h-3 w-3" />}
              {entry.scope === 'category' && <Tag className="h-3 w-3" />}
              {entry.scope === 'topic' && <Scale className="h-3 w-3" />}
              {scopeLabel(entry)} delegation
            </span>
            <span className="text-[10px] text-surface-600">·</span>
            <span className="text-[10px] text-surface-500">{relativeTime(entry.delegate_voted_at)}</span>
          </div>
        </div>

        {/* Delegate side chip */}
        <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg border flex-shrink-0', sideBg)}>
          <SideIcon className={cn('h-3.5 w-3.5', sideColor)} />
          <span className={cn('text-xs font-bold font-mono uppercase', sideColor)}>
            {entry.delegate_side}
          </span>
        </div>
      </div>

      {/* Topic */}
      <div className="px-4 py-3">
        <Link
          href={`/topic/${entry.topic_id}`}
          className="group flex items-start gap-2"
        >
          <p className="text-sm text-surface-700 group-hover:text-white transition-colors line-clamp-2 flex-1">
            {entry.topic_statement}
          </p>
          <ArrowRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-white flex-shrink-0 mt-0.5 transition-colors" />
        </Link>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {/* Status */}
          <span className={cn(
            'text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded',
            statusColors[entry.topic_status] ?? 'text-surface-400',
          )}>
            {entry.topic_status}
          </span>

          {/* Category */}
          {entry.topic_category && (
            <span className="text-[10px] text-surface-500 font-mono">
              {entry.topic_category}
            </span>
          )}

          {/* Vote split */}
          <span className="text-[10px] text-surface-500 font-mono ml-auto">
            {Math.round(entry.topic_blue_pct)}% FOR · {entry.topic_total_votes.toLocaleString()} votes
          </span>
        </div>

        {/* Vote bar */}
        <div className="mt-2 h-1 rounded-full overflow-hidden bg-surface-200 flex">
          <div
            className="h-full bg-for-500 rounded-l-full"
            style={{ width: `${entry.topic_blue_pct}%` }}
          />
          <div
            className="h-full bg-against-500 rounded-r-full"
            style={{ width: `${100 - entry.topic_blue_pct}%` }}
          />
        </div>
      </div>

      {/* Your vote footer */}
      {entry.is_override ? (
        <div className={cn(
          'flex items-center gap-2 px-4 py-2.5 border-t',
          entry.is_aligned
            ? 'border-emerald/20 bg-emerald/5'
            : 'border-against-500/20 bg-against-500/5',
        )}>
          {entry.is_aligned ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald flex-shrink-0" />
          ) : (
            <SplitSquareHorizontal className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
          )}
          <span className={cn(
            'text-xs font-mono',
            entry.is_aligned ? 'text-emerald' : 'text-against-400',
          )}>
            You voted{' '}
            <span className="font-bold uppercase">{entry.user_side}</span>
            {entry.is_aligned ? ' — aligned with delegate' : ' — overrode delegate'}
          </span>
          {entry.user_voted_at && (
            <span className="text-[10px] text-surface-600 ml-auto">
              {relativeTime(entry.user_voted_at)}
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-surface-200 bg-surface-100/50">
          <UserCheck className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
          <span className="text-xs text-surface-500 font-mono">
            Delegated — you did not vote separately
          </span>
          <Link
            href={`/topic/${entry.topic_id}`}
            className="ml-auto text-[10px] text-for-400 hover:text-for-300 font-mono transition-colors"
          >
            Vote now →
          </Link>
        </div>
      )}
    </motion.div>
  )
}

// ─── Filters ─────────────────────────────────────────────────────────────────

type FilterType = 'all' | 'delegated' | 'overrides' | 'aligned' | 'misaligned'

// ─── Main component ───────────────────────────────────────────────────────────

export function DelegationHistoryClient() {
  const [data, setData] = useState<DelegationHistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [showFilter, setShowFilter] = useState(false)

  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/delegation/history?limit=100')
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as DelegationHistoryResponse
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const filteredVotes = (data?.votes ?? []).filter(v => {
    switch (filter) {
      case 'delegated': return !v.is_override
      case 'overrides': return v.is_override
      case 'aligned': return v.is_aligned === true
      case 'misaligned': return v.is_aligned === false
      default: return true
    }
  })

  const filterOptions: { id: FilterType; label: string }[] = [
    { id: 'all', label: 'All votes' },
    { id: 'delegated', label: 'Fully delegated' },
    { id: 'overrides', label: 'My overrides' },
    { id: 'aligned', label: 'Aligned with delegate' },
    { id: 'misaligned', label: 'Differed from delegate' },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-8">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/delegate"
              className="text-surface-500 hover:text-white transition-colors"
              aria-label="Back to Delegate hub"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-purple/10 border border-purple/30">
                <History className="h-4.5 w-4.5 text-purple" />
              </div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Delegation History
              </h1>
            </div>
          </div>
          <p className="text-sm text-surface-500 font-mono ml-[52px]">
            Every vote your delegates cast on your behalf
          </p>
        </div>

        {/* Stats row */}
        {loading ? (
          <div className="flex gap-3 mb-6">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="flex-1 h-20 rounded-xl" />
            ))}
          </div>
        ) : data && (
          <div className="flex gap-3 mb-6">
            <StatTile
              label="Total votes"
              value={data.totalDelegated}
              sub="via delegation"
              colorClass="text-purple"
            />
            <StatTile
              label="Overrides"
              value={data.totalOverrides}
              sub="you voted too"
              colorClass="text-for-400"
            />
            <StatTile
              label="Alignment"
              value={data.alignmentPct !== null ? `${data.alignmentPct}%` : '—'}
              sub={data.alignmentPct !== null ? 'when you voted' : 'no overrides yet'}
              colorClass={
                data.alignmentPct === null ? 'text-surface-500'
                : data.alignmentPct >= 75 ? 'text-emerald'
                : data.alignmentPct >= 50 ? 'text-gold'
                : 'text-against-400'
              }
            />
          </div>
        )}

        {/* Filter bar */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => setShowFilter(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono',
              'transition-colors',
              showFilter
                ? 'bg-surface-300 border-surface-400 text-white'
                : 'bg-surface-100 border-surface-200 text-surface-500 hover:border-surface-400',
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            {filterOptions.find(o => o.id === filter)?.label ?? 'Filter'}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showFilter && 'rotate-180')} />
          </button>

          {filter !== 'all' && (
            <button
              onClick={() => setFilter('all')}
              className="text-xs text-surface-500 hover:text-white transition-colors font-mono"
            >
              Clear
            </button>
          )}

          <span className="ml-auto text-xs text-surface-500 font-mono">
            {filteredVotes.length} vote{filteredVotes.length !== 1 ? 's' : ''}
          </span>

          <button
            onClick={loadHistory}
            disabled={loading}
            className="text-surface-500 hover:text-white transition-colors disabled:opacity-40"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        <AnimatePresence>
          {showFilter && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="flex flex-wrap gap-2 pb-1">
                {filterOptions.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setFilter(opt.id)
                      setShowFilter(false)
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors',
                      filter === opt.id
                        ? 'bg-purple/20 border-purple/40 text-purple'
                        : 'bg-surface-100 border-surface-200 text-surface-500 hover:border-surface-400',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        ) : !data || filteredVotes.length === 0 ? (
          data?.votes.length === 0 ? (
            <EmptyState
              icon={<History className="h-10 w-10 text-surface-500" />}
              title="No delegation history yet"
              description={
                data
                  ? "Your delegates haven't voted on any topics since you delegated to them. Check back after they're more active."
                  : 'Set up your first delegation to start tracking votes automatically.'
              }
              action={
                <Link
                  href="/delegate"
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono font-medium',
                    'bg-purple/10 border border-purple/30 text-purple',
                    'hover:bg-purple/20 transition-colors',
                  )}
                >
                  <UserCheck className="h-4 w-4" />
                  Manage delegations
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={<Filter className="h-8 w-8 text-surface-500" />}
              title="No votes match this filter"
              description="Try a different filter to see more delegation history."
              action={
                <button
                  onClick={() => setFilter('all')}
                  className="text-sm text-for-400 hover:text-for-300 font-mono transition-colors"
                >
                  Show all votes
                </button>
              }
            />
          )
        ) : (
          <div className="space-y-3">
            {filteredVotes.map((entry) => (
              <VoteCard key={`${entry.delegation_id}:${entry.topic_id}`} entry={entry} />
            ))}
          </div>
        )}

        {/* Nav links */}
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-surface-200">
          <Link
            href="/delegate"
            className="flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors font-mono"
          >
            <ArrowLeft className="h-4 w-4" />
            Manage delegations
          </Link>
          <Link
            href="/delegate/impact"
            className="flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors font-mono"
          >
            Impact dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
