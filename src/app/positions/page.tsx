'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Flame,
  Gavel,
  Loader2,
  RefreshCw,
  Scale,
  Swords,
  Target,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { PositionItem, PositionStats, PositionsResponse } from '@/app/api/positions/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
  continued: 'Continued',
  archived: 'Archived',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
  continued: 'proposed',
  archived: 'proposed',
}

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  proposed: Scale,
  active: Zap,
  voting: Scale,
  law: Gavel,
  failed: XCircle,
  continued: Scale,
  archived: XCircle,
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'active' | 'law' | 'failed'

const TABS: { id: StatusFilter; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'all', label: 'All', icon: Target },
  { id: 'active', label: 'Active', icon: Zap },
  { id: 'law', label: 'Laws', icon: Gavel },
  { id: 'failed', label: 'Failed', icon: XCircle },
]

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function PositionSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 animate-pulse">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="h-4 w-16 bg-surface-300 rounded-full" />
        <div className="h-4 w-20 bg-surface-300 rounded-full" />
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-4 w-full bg-surface-300 rounded" />
        <div className="h-4 w-3/4 bg-surface-300 rounded" />
      </div>
      <div className="h-2 w-full bg-surface-300 rounded-full" />
    </div>
  )
}

// ─── Stats card ───────────────────────────────────────────────────────────────

function StatsCard({ stats }: { stats: PositionStats }) {
  const majorityPct = stats.total > 0 ? Math.round((stats.in_majority / stats.total) * 100) : 0
  const contrarianPct = 100 - majorityPct

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-for-500/10 border border-for-500/30">
          <Target className="h-4 w-4 text-for-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Position Overview</h2>
          <p className="text-[11px] font-mono text-surface-500">{stats.total} votes cast total</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-surface-200 border border-surface-300 p-3 text-center">
          <div className="text-2xl font-mono font-bold text-white">{stats.total}</div>
          <div className="text-[10px] font-mono text-surface-500 mt-0.5">Total</div>
        </div>

        <div className="rounded-xl bg-for-500/10 border border-for-500/20 p-3 text-center">
          <div className="text-2xl font-mono font-bold text-for-400">{majorityPct}%</div>
          <div className="text-[10px] font-mono text-for-600 mt-0.5 flex items-center justify-center gap-1">
            <TrendingUp className="h-2.5 w-2.5" />
            With majority
          </div>
        </div>

        <div className="rounded-xl bg-surface-200 border border-surface-300 p-3 text-center">
          <div className="text-2xl font-mono font-bold text-surface-400">{contrarianPct}%</div>
          <div className="text-[10px] font-mono text-surface-500 mt-0.5 flex items-center justify-center gap-1">
            <TrendingDown className="h-2.5 w-2.5" />
            Contrarian
          </div>
        </div>

        <div className="rounded-xl bg-emerald/10 border border-emerald/20 p-3 text-center">
          <div className="text-2xl font-mono font-bold text-emerald">{stats.laws_supported}</div>
          <div className="text-[10px] font-mono text-emerald/70 mt-0.5 flex items-center justify-center gap-1">
            <Gavel className="h-2.5 w-2.5" />
            Laws FOR
          </div>
        </div>
      </div>

      {stats.total > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-[10px] font-mono text-surface-500 mb-1">
            <span className="text-for-400">With majority · {stats.in_majority}</span>
            <span className="text-surface-400">Contrarian · {stats.as_contrarian}</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full bg-for-500 rounded-full transition-all duration-700"
              style={{ width: `${majorityPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Position card ────────────────────────────────────────────────────────────

function PositionCard({ position, index }: { position: PositionItem; index: number }) {
  const { side, in_majority, voted_at, topic } = position
  const isFor = side === 'blue'
  const StatusIcon = STATUS_ICON[topic.status] ?? Scale
  const badgeVariant = STATUS_BADGE[topic.status] ?? 'proposed'
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'group relative flex flex-col gap-3 rounded-2xl border p-5 transition-all',
          'hover:border-surface-400 hover:bg-surface-200/60',
          isFor
            ? 'border-for-500/25 bg-for-500/[0.03]'
            : 'border-against-500/25 bg-against-500/[0.03]',
        )}
      >
        {/* Top row: your vote + status + time */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border',
                isFor
                  ? 'bg-for-500/15 border-for-500/40 text-for-300'
                  : 'bg-against-500/15 border-against-500/40 text-against-300',
              )}
            >
              {isFor ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {isFor ? 'FOR' : 'AGAINST'}
            </span>

            {in_majority ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-for-500">
                <TrendingUp className="h-3 w-3" />
                majority
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-500">
                <Swords className="h-3 w-3" />
                contrarian
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant={badgeVariant}>
              <StatusIcon className="h-2.5 w-2.5 mr-1" />
              {STATUS_LABEL[topic.status] ?? topic.status}
            </Badge>
            <span className="text-[10px] font-mono text-surface-500 whitespace-nowrap">
              {relativeTime(voted_at)}
            </span>
          </div>
        </div>

        {/* Statement */}
        <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-surface-100 transition-colors">
          {topic.statement}
        </p>

        {/* Vote bar + category */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-for-400 w-8 text-right shrink-0">{forPct}%</span>
            <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
              <div className="flex h-full rounded-full overflow-hidden">
                <div
                  className="bg-for-500 h-full transition-all duration-500"
                  style={{ width: `${forPct}%` }}
                />
                <div
                  className="bg-against-500 h-full transition-all duration-500"
                  style={{ width: `${againstPct}%` }}
                />
              </div>
            </div>
            <span className="text-[11px] font-mono text-against-400 w-8 shrink-0">{againstPct}%</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {topic.category && (
                <span className="text-[10px] font-mono text-purple/80">{topic.category}</span>
              )}
              {topic.scope !== 'national' && (
                <>
                  <span className="text-[10px] text-surface-600">·</span>
                  <span className="text-[10px] font-mono text-surface-600 capitalize">{topic.scope}</span>
                </>
              )}
            </div>
            <span className="text-[10px] font-mono text-surface-600">
              {topic.total_votes.toLocaleString()} votes
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PositionsPage() {
  const [activeTab, setActiveTab] = useState<StatusFilter>('all')
  const [positions, setPositions] = useState<PositionItem[]>([])
  const [stats, setStats] = useState<PositionStats | null>(null)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const LIMIT = 30

  const fetchPositions = useCallback(async (tab: StatusFilter, currentOffset: number, append = false) => {
    if (!append) setIsLoading(true)
    else setIsLoadingMore(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        status: tab,
        limit: String(LIMIT),
        offset: String(currentOffset),
      })
      const res = await fetch(`/api/positions?${params}`)
      if (!res.ok) throw new Error('Failed to load positions')

      const data = (await res.json()) as PositionsResponse

      if (append) {
        setPositions((prev) => [...prev, ...data.positions])
      } else {
        setPositions(data.positions)
        setStats(data.stats)
        setOffset(0)
      }

      setTotal(data.total)
      setHasMore(currentOffset + LIMIT < data.total)
      setOffset(currentOffset + LIMIT)
    } catch {
      setError('Could not load your positions. Please try again.')
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    fetchPositions(activeTab, 0, false)
  }, [activeTab, fetchPositions])

  function handleTabChange(tab: StatusFilter) {
    setActiveTab(tab)
    setPositions([])
    setOffset(0)
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
              <Scale className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">My Positions</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Every stance you&apos;ve taken in the Lobby
              </p>
            </div>
          </div>

          <button
            onClick={() => fetchPositions(activeTab, 0, false)}
            disabled={isLoading}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Refresh positions"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </button>
        </div>

        {/* Stats */}
        {stats && !isLoading && <StatsCard stats={stats} />}
        {isLoading && (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-6 animate-pulse">
            <div className="h-5 w-40 bg-surface-300 rounded mb-4" />
            <div className="grid grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-surface-300 rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-5 bg-surface-100 border border-surface-300 rounded-xl p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[12px] font-mono font-medium transition-all',
                  isActive
                    ? 'bg-surface-200 text-white shadow-sm'
                    : 'text-surface-500 hover:text-surface-300 hover:bg-surface-200/50',
                )}
                aria-pressed={isActive}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-against-500/30 bg-against-500/10 p-4 mb-4 text-sm text-against-300 font-mono text-center">
            {error}
          </div>
        )}

        {/* Loading skeletons */}
        {isLoading && (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <PositionSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && positions.length === 0 && (
          <EmptyState
            icon={Scale}
            iconColor="text-for-400"
            iconBg="bg-for-500/10"
            iconBorder="border-for-500/20"
            title={activeTab === 'all' ? "No positions yet" : `No ${activeTab === 'law' ? 'laws' : activeTab} positions`}
            description={
              activeTab === 'all'
                ? "You haven't voted on any topics yet. Jump into the feed to take your first stance."
                : `You haven't voted on any topics that are currently ${activeTab}.`
            }
            actions={[
              { label: 'Go to the feed', href: '/' },
              ...(activeTab !== 'all' ? [{ label: 'View all positions', onClick: () => handleTabChange('all') }] : []),
            ]}
            size="md"
          />
        )}

        {/* Position list */}
        {!isLoading && positions.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-mono text-surface-500">
                {total} position{total !== 1 ? 's' : ''}
                {activeTab !== 'all' ? ` (${activeTab === 'law' ? 'laws' : activeTab})` : ''}
              </p>
            </div>

            <AnimatePresence mode="wait">
              <div className="space-y-3">
                {positions.map((position, idx) => (
                  <PositionCard key={position.vote_id} position={position} index={idx} />
                ))}
              </div>
            </AnimatePresence>

            {/* Load more */}
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => fetchPositions(activeTab, offset, true)}
                  disabled={isLoadingMore}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    <>
                      <Flame className="h-4 w-4" />
                      Load more
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
