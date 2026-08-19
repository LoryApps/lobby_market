'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Coins,
  Gavel,
  Loader2,
  RefreshCw,
  Target,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { NetworkPredictionItem, NetworkPredictionsResponse } from '@/app/api/network/predictions/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

function NetworkTabs({ active }: { active: string }) {
  const tabs = [
    { label: 'Activity',     href: '/network' },
    { label: 'Topics',       href: '/network/topics' },
    { label: 'Votes',        href: '/network/votes' },
    { label: 'Arguments',    href: '/network/arguments' },
    { label: 'Achievements', href: '/network/achievements' },
    { label: 'Debates',      href: '/network/debates' },
    { label: 'Laws',         href: '/network/laws' },
    { label: 'People',       href: '/network/people' },
    { label: 'Coalitions',   href: '/network/coalitions' },
    { label: 'Predictions',  href: '/network/predictions' },
    { label: 'Relays',       href: '/network/relays' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-1 p-1 mb-5 rounded-xl bg-surface-100 border border-surface-300 w-fit">
      {tabs.map((t) =>
        t.href === active ? (
          <span
            key={t.href}
            className="px-3 py-1.5 text-xs font-mono font-semibold rounded-lg bg-surface-200 border border-surface-300 text-white"
          >
            {t.label}
          </span>
        ) : (
          <Link
            key={t.href}
            href={t.href}
            className="px-3 py-1.5 text-xs font-mono font-medium rounded-lg text-surface-400 hover:text-white transition-colors"
          >
            {t.label}
          </Link>
        ),
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PredictionSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4 border-b border-surface-300/60 last:border-0">
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-24 rounded" />
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-3 w-12 rounded ml-auto" />
        </div>
        <div className="rounded-xl border border-surface-300 p-3 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-3 pt-1">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Verdict chip ─────────────────────────────────────────────────────────────

function VerdictChip({ correct }: { correct: boolean | null }) {
  if (correct === null) return null
  return correct ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald/10 text-emerald border border-emerald/30">
      <CheckCircle2 className="h-3 w-3" aria-hidden />
      Correct
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-against-500/10 text-against-400 border border-against-500/30">
      <XCircle className="h-3 w-3" aria-hidden />
      Wrong
    </span>
  )
}

// ─── Prediction card ─────────────────────────────────────────────────────────

function PredictionRow({ item, index }: { item: NetworkPredictionItem; index: number }) {
  const forPct = Math.round(item.topic.blue_pct)
  const againstPct = 100 - forPct
  const isResolved = item.resolved_at !== null

  const statusBadge = {
    proposed: 'proposed' as const,
    active:   'active' as const,
    voting:   'active' as const,
    law:      'law' as const,
    failed:   'failed' as const,
  }[item.topic.status] ?? ('proposed' as const)

  const statusLabel = {
    proposed: 'Proposed',
    active:   'Active',
    voting:   'Voting',
    law:      'LAW',
    failed:   'Failed',
  }[item.topic.status] ?? item.topic.status

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.4) }}
      className="flex items-start gap-3 p-4 border-b border-surface-300/50 last:border-0"
    >
      {/* Actor avatar */}
      <Link
        href={`/profile/${item.actor.username}`}
        className="flex-shrink-0 mt-0.5"
        aria-label={`View @${item.actor.username}`}
      >
        <Avatar
          src={item.actor.avatar_url}
          fallback={item.actor.display_name || item.actor.username}
          size="sm"
        />
      </Link>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Actor + timestamp */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
          <Link
            href={`/profile/${item.actor.username}`}
            className="font-semibold text-xs text-white hover:text-for-300 transition-colors"
          >
            {item.actor.display_name || item.actor.username}
          </Link>
          <span className="text-[11px] text-surface-500">
            predicted this will{' '}
            <span
              className={cn(
                'font-semibold',
                item.predicted_law ? 'text-emerald' : 'text-against-400'
              )}
            >
              {item.predicted_law ? 'become law' : 'fail'}
            </span>
          </span>
          <span className="text-[10px] text-surface-600 ml-auto whitespace-nowrap">
            {relativeTime(item.created_at)}
          </span>
        </div>

        {/* Topic card */}
        <Link
          href={`/topic/${item.topic.id}`}
          className={cn(
            'block rounded-xl border p-3 transition-colors group',
            'bg-surface-200/60 border-surface-300',
            'hover:border-surface-400/60 hover:bg-surface-200/80'
          )}
        >
          {/* Status + category */}
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={statusBadge} size="sm">
              {statusLabel}
            </Badge>
            {item.topic.category && (
              <span className="text-[11px] font-mono text-surface-500">
                {item.topic.category}
              </span>
            )}
          </div>

          {/* Statement */}
          <p className="text-sm font-medium text-white leading-snug line-clamp-2 mb-2.5 group-hover:text-for-200 transition-colors">
            {item.topic.statement}
          </p>

          {/* Vote bar */}
          <div className="space-y-1.5 mb-2.5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-for-400 flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" aria-hidden />
                {forPct}%
              </span>
              <span className="text-surface-600">
                {item.topic.total_votes.toLocaleString()} votes
              </span>
              <span className="text-against-400 flex items-center gap-1">
                {againstPct}%
                <ThumbsDown className="h-3 w-3" aria-hidden />
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-for-600 to-for-400"
                style={{ width: `${forPct}%` }}
              />
            </div>
          </div>

          {/* Prediction meta */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Confidence badge */}
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                item.predicted_law
                  ? 'bg-emerald/10 text-emerald border-emerald/30'
                  : 'bg-against-500/10 text-against-400 border-against-500/30'
              )}
            >
              <Target className="h-3 w-3" aria-hidden />
              {item.confidence}% confident
            </span>

            {/* Outcome status */}
            {isResolved ? (
              <VerdictChip correct={item.correct} />
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-surface-300/50 text-surface-500 border border-surface-400/30">
                Pending
              </span>
            )}

            {/* Clout earned */}
            {item.clout_earned > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-gold/10 text-gold border border-gold/30 ml-auto">
                <Coins className="h-3 w-3" aria-hidden />
                +{item.clout_earned} clout
              </span>
            )}
          </div>
        </Link>

        {/* Law icon if topic became law */}
        {item.topic.status === 'law' && item.predicted_law && item.correct && (
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-gold font-mono">
            <Gavel className="h-3.5 w-3.5" aria-hidden />
            Called it — this became law
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NetworkPredictionsPage() {
  const router = useRouter()
  const [data, setData] = useState<NetworkPredictionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cursorRef = useRef<string | null>(null)
  const itemsRef = useRef<NetworkPredictionItem[]>([])

  const fetchPredictions = useCallback(async (append = false) => {
    if (append) setLoadingMore(true)
    else { setLoading(true); setError(null) }

    try {
      const params = new URLSearchParams({ limit: '30' })
      if (append && cursorRef.current) params.set('cursor', cursorRef.current)

      const res = await fetch(`/api/network/predictions?${params}`)
      if (!res.ok) throw new Error('Failed to load')

      const json: NetworkPredictionsResponse = await res.json()

      if (append) {
        const merged = [...itemsRef.current, ...json.items]
        itemsRef.current = merged
        setData({ ...json, items: merged })
      } else {
        itemsRef.current = json.items
        setData(json)
      }

      cursorRef.current = json.cursor
    } catch {
      setError('Could not load network predictions. Please try again.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => { fetchPredictions() }, [fetchPredictions])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white">Network</h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Predictions from people you follow
            </p>
          </div>
          <button
            onClick={() => fetchPredictions()}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-40"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Tab bar */}
        <NetworkTabs active="/network/predictions" />

        {/* Content */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">

          {loading ? (
            <>
              {Array.from({ length: 5 }).map((_, i) => (
                <PredictionSkeleton key={i} />
              ))}
            </>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-sm text-against-400 mb-3">{error}</p>
              <button
                onClick={() => fetchPredictions()}
                className="text-xs font-mono text-for-400 hover:text-for-300 underline"
              >
                Try again
              </button>
            </div>
          ) : data?.is_empty ? (
            <div className="py-16 px-4">
              <EmptyState
                icon={Target}
                iconColor="text-purple"
                iconBg="bg-purple/10"
                iconBorder="border-purple/30"
                title="No predictions yet"
                description={
                  data.following_count === 0
                    ? 'Follow people to see their predictions here.'
                    : 'No one you follow has made predictions yet.'
                }
                action={
                  data.following_count === 0
                    ? { label: 'Find people to follow', href: '/network/people' }
                    : { label: 'Make a prediction', href: '/predictions' }
                }
                size="md"
              />
            </div>
          ) : (
            <>
              <AnimatePresence initial={false}>
                {data?.items.map((item, i) => (
                  <PredictionRow key={item.prediction_id} item={item} index={i} />
                ))}
              </AnimatePresence>

              {/* Load more */}
              {data?.cursor && (
                <div className="flex justify-center py-4 border-t border-surface-300/60">
                  <button
                    onClick={() => fetchPredictions(true)}
                    disabled={loadingMore}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-medium transition-colors',
                      'text-surface-400 hover:text-white bg-surface-200 hover:bg-surface-300 border border-surface-400/40',
                      'disabled:opacity-50'
                    )}
                  >
                    {loadingMore ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}

              {/* Following count footer */}
              {data && data.following_count > 0 && (
                <div className="px-4 py-2.5 border-t border-surface-300/60 text-center">
                  <span className="text-[11px] font-mono text-surface-600">
                    From {data.following_count} people you follow
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
