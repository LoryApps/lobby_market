'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  GitMerge,
  Loader2,
  Plus,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { RelayRow } from '@/app/api/relays/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  topicId: string
  statement: string
  category: string | null
  status: string
  bluePct: number
}

type SideFilter = 'all' | 'for' | 'against'
type StatusFilter = 'all' | 'open' | 'in_progress' | 'complete'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Pill components ─────────────────────────────────────────────────────────

function StatusPill({ status }: { status: RelayRow['status'] }) {
  const config: Record<RelayRow['status'], { label: string; cls: string }> = {
    open:        { label: 'Open',        cls: 'text-emerald border-emerald/30 bg-emerald/10' },
    in_progress: { label: 'In Progress', cls: 'text-gold border-gold/30 bg-gold/10' },
    complete:    { label: 'Complete',    cls: 'text-for-400 border-for-500/30 bg-for-500/10' },
    voted:       { label: 'Voted',       cls: 'text-surface-400 border-surface-400/30 bg-surface-300/10' },
  }
  const { label, cls } = config[status]
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border', cls)}>
      {label}
    </span>
  )
}

function LegDots({ filled, total, isFor }: { filled: number; total: number; isFor: boolean }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${filled} of ${total} legs`}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 w-1.5 rounded-full transition-colors',
            i < filled
              ? isFor ? 'bg-for-500' : 'bg-against-500'
              : 'bg-surface-500'
          )}
        />
      ))}
    </div>
  )
}

// ─── Relay card ───────────────────────────────────────────────────────────────

function RelayCard({ relay }: { relay: RelayRow }) {
  const isFor = relay.side === 'for'
  const firstLeg = relay.legs[0]
  const lastLeg = relay.legs[relay.legs.length - 1] ?? firstLeg
  const legCount = relay.legs.length

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Link
        href={`/relays/${relay.id}`}
        className={cn(
          'block rounded-xl border bg-surface-900 p-4 transition-all hover:border-surface-500',
          isFor
            ? 'border-for-900/60 hover:border-for-700/50'
            : 'border-against-900/60 hover:border-against-700/50'
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-bold border',
                isFor
                  ? 'text-for-400 border-for-800 bg-for-950/40'
                  : 'text-against-400 border-against-800 bg-against-950/40'
              )}
            >
              {isFor ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
              {isFor ? 'FOR' : 'AGAINST'}
            </div>
            <StatusPill status={relay.status} />
          </div>
          <LegDots filled={legCount} total={relay.max_legs} isFor={isFor} />
        </div>

        {/* First leg preview */}
        {firstLeg && (
          <p className="text-sm text-surface-200 leading-relaxed line-clamp-3 mb-3">
            &ldquo;{firstLeg.content}&rdquo;
          </p>
        )}

        {/* Contributors row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Starter */}
            <div className="flex items-center gap-1.5">
              <Avatar
                src={relay.starter_avatar_url}
                fallback={relay.starter_display_name || relay.starter_username}
                size="xs"
              />
              <span className="text-xs text-surface-400 font-mono">
                {relay.starter_display_name || relay.starter_username}
              </span>
            </div>

            {/* Extra contributor avatars */}
            {relay.legs.length > 1 && (
              <div className="flex -space-x-1.5">
                {relay.legs.slice(1).map((leg) => (
                  <Avatar
                    key={leg.id}
                    src={leg.author?.avatar_url ?? null}
                    fallback={leg.author?.display_name || leg.author?.username || '?'}
                    size="xs"
                    className="ring-1 ring-surface-900"
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-surface-500 font-mono">
            <span>{legCount}/{relay.max_legs} legs</span>
            <span>{relativeTime(relay.created_at)}</span>
            <ArrowRight className="h-3.5 w-3.5 text-surface-600" />
          </div>
        </div>

        {/* Last leg snippet if different from first */}
        {lastLeg && lastLeg.id !== firstLeg?.id && (
          <div className={cn(
            'mt-3 pt-3 border-t text-xs text-surface-500 italic line-clamp-2',
            isFor ? 'border-for-900/40' : 'border-against-900/40'
          )}>
            Latest: &ldquo;{lastLeg.content.slice(0, 120)}{lastLeg.content.length > 120 ? '…' : ''}&rdquo;
          </div>
        )}
      </Link>
    </motion.div>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function RelayCardSkeleton() {
  return (
    <div className="rounded-xl border border-surface-800 bg-surface-900 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-1.5 w-1.5 rounded-full" />
          ))}
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function FilterBar({
  side,
  status,
  onSide,
  onStatus,
}: {
  side: SideFilter
  status: StatusFilter
  onSide: (v: SideFilter) => void
  onStatus: (v: StatusFilter) => void
}) {
  const sideOptions: { value: SideFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'for', label: 'FOR' },
    { value: 'against', label: 'AGAINST' },
  ]
  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Any Status' },
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'complete', label: 'Complete' },
  ]

  return (
    <div className="flex flex-col gap-2">
      {/* Side filter */}
      <div className="flex gap-1.5">
        {sideOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSide(opt.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-all',
              side === opt.value
                ? opt.value === 'for'
                  ? 'bg-for-600 border-for-500 text-white'
                  : opt.value === 'against'
                  ? 'bg-against-600 border-against-500 text-white'
                  : 'bg-surface-600 border-surface-500 text-white'
                : 'bg-surface-900 border-surface-700 text-surface-400 hover:border-surface-500 hover:text-surface-200'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {/* Status filter */}
      <div className="flex gap-1.5 flex-wrap">
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onStatus(opt.value)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-mono border transition-all',
              status === opt.value
                ? 'bg-surface-600 border-surface-500 text-white'
                : 'bg-surface-900 border-surface-700 text-surface-400 hover:border-surface-500 hover:text-surface-200'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TopicRelaysClient({ topicId, statement, category, status: _status, bluePct }: Props) {
  const [relays, setRelays] = useState<RelayRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [side, setSide] = useState<SideFilter>('all')
  const [relayStatus, setRelayStatus] = useState<StatusFilter>('all')
  const PAGE = 12

  const fetchRelays = useCallback(
    async (offset = 0, append = false) => {
      if (offset === 0) setLoading(true)
      else setLoadingMore(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          topic_id: topicId,
          limit: String(PAGE),
          offset: String(offset),
        })
        if (side !== 'all') params.set('side', side)
        if (relayStatus !== 'all') params.set('status', relayStatus)

        const res = await fetch(`/api/relays?${params}`)
        if (!res.ok) throw new Error('Failed to load relays')
        const json = await res.json()

        setRelays((prev) => (append ? [...prev, ...json.relays] : json.relays))
        setTotal(json.total)
      } catch {
        setError('Could not load relay chains.')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [topicId, side, relayStatus]
  )

  useEffect(() => {
    fetchRelays(0, false)
  }, [fetchRelays])

  const forRelays = relays.filter((r) => r.side === 'for')
  const againstRelays = relays.filter((r) => r.side === 'against')
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct

  return (
    <div className="relative flex flex-col h-screen bg-surface-950">
      <TopBar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
          {/* Back link */}
          <Link
            href={`/topic/${topicId}`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-surface-200 transition-colors mb-5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to topic
          </Link>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <GitMerge className="h-5 w-5 text-purple" />
              <h1 className="text-lg font-bold text-white">Relay Chains</h1>
              {category && (
                <Badge variant="proposed" className="text-[10px]">
                  {category}
                </Badge>
              )}
            </div>
            <p className="text-sm text-surface-400 line-clamp-2 mb-3">{statement}</p>

            {/* Vote split bar */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-mono text-for-400">{forPct}% FOR</span>
              <div className="flex-1 h-1.5 rounded-full bg-surface-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-for-600 to-for-500 rounded-full"
                  style={{ width: `${forPct}%` }}
                />
              </div>
              <span className="text-xs font-mono text-against-400">{againstPct}% AGAINST</span>
            </div>

            {/* Start relay CTA */}
            <Link
              href={`/relays/create?topic_id=${topicId}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple/10 border border-purple/30 text-purple hover:bg-purple/20 hover:border-purple/50 transition-all text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              Start a Relay Chain
            </Link>
          </div>

          {/* Filters */}
          <div className="mb-5">
            <FilterBar
              side={side}
              status={relayStatus}
              onSide={setSide}
              onStatus={setRelayStatus}
            />
          </div>

          {/* Stats bar */}
          {!loading && (
            <div className="flex items-center justify-between mb-4 text-xs font-mono text-surface-500">
              <span>{total} relay{total !== 1 ? 's' : ''}</span>
              <button
                onClick={() => fetchRelays(0, false)}
                className="flex items-center gap-1 hover:text-surface-300 transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </button>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <RelayCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="text-center py-12 text-surface-400 text-sm">
              <p className="mb-3">{error}</p>
              <button
                onClick={() => fetchRelays(0, false)}
                className="text-purple hover:text-purple/80 transition-colors font-mono text-xs"
              >
                Try again
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && relays.length === 0 && (
            <EmptyState
              icon={GitMerge}
              title="No relay chains yet"
              description={
                side === 'all'
                  ? 'Be the first to start a collaborative argument chain on this topic.'
                  : `No ${side.toUpperCase()} relay chains match these filters.`
              }
              action={{
                label: 'Start the first relay',
                href: `/relays/create?topic_id=${topicId}`,
                icon: Plus,
                variant: 'primary',
              }}
            />
          )}

          {/* Two-column layout when showing all sides */}
          {!loading && !error && relays.length > 0 && side === 'all' && (
            <div className="grid grid-cols-1 gap-3">
              {/* FOR section */}
              {forRelays.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <ThumbsUp className="h-3.5 w-3.5 text-for-500" />
                    <span className="text-xs font-mono font-semibold text-for-400 uppercase tracking-wider">
                      For — {forRelays.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                      {forRelays.map((relay) => (
                        <RelayCard key={relay.id} relay={relay} />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* AGAINST section */}
              {againstRelays.length > 0 && (
                <div className={forRelays.length > 0 ? 'mt-4' : ''}>
                  <div className="flex items-center gap-2 mb-2">
                    <ThumbsDown className="h-3.5 w-3.5 text-against-500" />
                    <span className="text-xs font-mono font-semibold text-against-400 uppercase tracking-wider">
                      Against — {againstRelays.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                      {againstRelays.map((relay) => (
                        <RelayCard key={relay.id} relay={relay} />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Single-side filtered list */}
          {!loading && !error && relays.length > 0 && side !== 'all' && (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {relays.map((relay) => (
                  <RelayCard key={relay.id} relay={relay} />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Load more */}
          {!loading && !error && relays.length < total && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => fetchRelays(relays.length, true)}
                disabled={loadingMore}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-surface-700 text-surface-300 hover:border-surface-500 hover:text-white transition-all text-sm font-mono disabled:opacity-50"
              >
                {loadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                {loadingMore ? 'Loading…' : `Load more (${total - relays.length} remaining)`}
              </button>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
