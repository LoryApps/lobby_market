'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  GitMerge,
  Link2,
  Loader2,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { NetworkRelayItem, NetworkRelaysResponse } from '@/app/api/network/relays/route'

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

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  open: {
    label: 'Open',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    icon: Clock,
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    icon: Zap,
  },
  complete: {
    label: 'Complete',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    icon: CheckCircle2,
  },
  voted: {
    label: 'Voted',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    icon: Trophy,
  },
} as const

type RelayStatus = keyof typeof STATUS_CONFIG

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

function RelaySkeleton() {
  return (
    <div className="flex items-start gap-3 p-4 border-b border-surface-300/60 last:border-0">
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-24 rounded" />
          <Skeleton className="h-3 w-32 rounded" />
          <Skeleton className="h-3 w-12 rounded ml-auto" />
        </div>
        <div className="rounded-xl border border-surface-300 p-3 space-y-2.5">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-3 w-48" />
          <div className="h-1.5 rounded-full bg-surface-300" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Leg progress bar ─────────────────────────────────────────────────────────

function LegProgress({ current, max }: { current: number; max: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {Array.from({ length: max }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 w-5 rounded-full transition-colors',
              i < current ? 'bg-for-500' : 'bg-surface-400/40'
            )}
          />
        ))}
      </div>
      <span className="text-[10px] font-mono text-surface-500">
        {current}/{max} legs
      </span>
    </div>
  )
}

// ─── Relay card ───────────────────────────────────────────────────────────────

function RelayRow({ item, index }: { item: NetworkRelayItem; index: number }) {
  const statusConf = STATUS_CONFIG[item.relay_status as RelayStatus] ?? STATUS_CONFIG.open
  const StatusIcon = statusConf.icon
  const totalVotes = item.vote_compelling + item.vote_not_compelling

  const topicStatusBadge = {
    proposed: 'proposed' as const,
    active:   'active' as const,
    voting:   'active' as const,
    law:      'law' as const,
    failed:   'failed' as const,
  }[item.topic.status] ?? ('proposed' as const)

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
        {/* Actor + action + timestamp */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
          <Link
            href={`/profile/${item.actor.username}`}
            className="font-semibold text-xs text-white hover:text-for-300 transition-colors"
          >
            {item.actor.display_name || item.actor.username}
          </Link>
          {item.event_type === 'started' ? (
            <span className="text-[11px] text-surface-500">
              started a relay{' '}
              <span className={cn(
                'font-semibold',
                item.relay_side === 'for' ? 'text-for-400' : 'text-against-400'
              )}>
                {item.relay_side === 'for' ? 'FOR' : 'AGAINST'}
              </span>
            </span>
          ) : (
            <span className="text-[11px] text-surface-500">
              added leg {item.leg_number} to a relay{' '}
              <span className={cn(
                'font-semibold',
                item.relay_side === 'for' ? 'text-for-400' : 'text-against-400'
              )}>
                {item.relay_side === 'for' ? 'FOR' : 'AGAINST'}
              </span>
            </span>
          )}
          <span className="text-[10px] text-surface-600 ml-auto whitespace-nowrap">
            {relativeTime(item.occurred_at)}
          </span>
        </div>

        {/* Relay card */}
        <Link
          href={`/relays/${item.relay_id}`}
          className={cn(
            'block rounded-xl border p-3 transition-colors group',
            'bg-surface-200/60 border-surface-300',
            'hover:border-surface-400/60 hover:bg-surface-200/80'
          )}
        >
          {/* Status + topic status + category */}
          <div className="flex items-center gap-2 flex-wrap mb-2.5">
            {/* Relay status */}
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                statusConf.color, statusConf.bg, statusConf.border
              )}
            >
              <StatusIcon className="h-3 w-3" aria-hidden />
              {statusConf.label}
            </span>

            {/* Side chip */}
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                item.relay_side === 'for'
                  ? 'bg-for-500/10 text-for-400 border-for-500/30'
                  : 'bg-against-500/10 text-against-400 border-against-500/30'
              )}
            >
              {item.relay_side === 'for' ? (
                <ThumbsUp className="h-3 w-3" aria-hidden />
              ) : (
                <ThumbsDown className="h-3 w-3" aria-hidden />
              )}
              {item.relay_side === 'for' ? 'For' : 'Against'}
            </span>

            {/* Topic badge */}
            <Badge variant={topicStatusBadge} size="sm">
              {item.topic.status === 'law' ? 'LAW' : item.topic.status}
            </Badge>

            {item.topic.category && (
              <span className="text-[11px] font-mono text-surface-500">
                {item.topic.category}
              </span>
            )}
          </div>

          {/* Topic statement */}
          <p className="text-sm font-medium text-white leading-snug line-clamp-2 mb-2.5 group-hover:text-for-200 transition-colors">
            {item.topic.statement}
          </p>

          {/* Leg preview (show leg content if contributed) */}
          {item.leg_content && (
            <div className="mb-2.5 pl-3 border-l-2 border-surface-400/40">
              <p className="text-[11px] text-surface-400 leading-relaxed line-clamp-2 italic">
                &ldquo;{item.leg_content}&rdquo;
              </p>
            </div>
          )}

          {/* Leg progress */}
          <div className="mb-2.5">
            <LegProgress current={item.relay_leg_count} max={item.relay_max_legs} />
          </div>

          {/* Compelling votes (for complete/voted relays) */}
          {(item.relay_status === 'complete' || item.relay_status === 'voted') && totalVotes > 0 && (
            <div className="flex items-center gap-3 pt-1">
              <span className="text-[10px] font-mono text-surface-500">Verdict:</span>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald">
                  <ThumbsUp className="h-3 w-3" aria-hidden />
                  {item.vote_compelling} compelling
                </span>
                <span className="text-[10px] text-surface-600">/</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-500">
                  <ThumbsDown className="h-3 w-3" aria-hidden />
                  {item.vote_not_compelling}
                </span>
              </div>
            </div>
          )}
        </Link>

        {/* Join CTA for open relays */}
        {(item.relay_status === 'open' || item.relay_status === 'in_progress') &&
          item.relay_leg_count < item.relay_max_legs && (
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-for-400 font-mono">
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            <Link
              href={`/relays/${item.relay_id}`}
              className="hover:text-for-300 transition-colors"
            >
              Add your leg to this relay
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NetworkRelaysPage() {
  const router = useRouter()
  const [data, setData] = useState<NetworkRelaysResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cursorRef = useRef<string | null>(null)
  const itemsRef = useRef<NetworkRelayItem[]>([])

  const fetchRelays = useCallback(async (append = false) => {
    if (append) setLoadingMore(true)
    else { setLoading(true); setError(null) }

    try {
      const params = new URLSearchParams({ limit: '30' })
      if (append && cursorRef.current) params.set('cursor', cursorRef.current)

      const res = await fetch(`/api/network/relays?${params}`)
      if (!res.ok) throw new Error('Failed to load')

      const json: NetworkRelaysResponse = await res.json()

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
      setError('Could not load network relays. Please try again.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => { fetchRelays() }, [fetchRelays])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white">Network</h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Relay chains from people you follow
            </p>
          </div>
          <button
            onClick={() => fetchRelays()}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-40"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Tab bar */}
        <NetworkTabs active="/network/relays" />

        {/* Content */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">

          {loading ? (
            <>
              {Array.from({ length: 5 }).map((_, i) => (
                <RelaySkeleton key={i} />
              ))}
            </>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-sm text-against-400 mb-3">{error}</p>
              <button
                onClick={() => fetchRelays()}
                className="text-xs font-mono text-for-400 hover:text-for-300 underline"
              >
                Try again
              </button>
            </div>
          ) : data?.is_empty ? (
            <div className="py-16 px-4">
              <EmptyState
                icon={GitMerge}
                iconColor="text-for-400"
                iconBg="bg-for-500/10"
                iconBorder="border-for-500/30"
                title="No relay activity yet"
                description={
                  data.following_count === 0
                    ? 'Follow people to see their relay contributions here.'
                    : 'No one you follow has contributed to a relay yet.'
                }
                action={
                  data.following_count === 0
                    ? { label: 'Find people to follow', href: '/network/people' }
                    : { label: 'Start or join a relay', href: '/relays' }
                }
                size="md"
              />
            </div>
          ) : (
            <>
              <AnimatePresence initial={false}>
                {data?.items.map((item, i) => (
                  <RelayRow key={item.item_id} item={item} index={i} />
                ))}
              </AnimatePresence>

              {/* Load more */}
              {data?.cursor && (
                <div className="flex justify-center py-4 border-t border-surface-300/60">
                  <button
                    onClick={() => fetchRelays(true)}
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

        {/* Info card: what are relays */}
        <div className="mt-4 rounded-xl border border-surface-300/60 bg-surface-100/50 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <GitMerge className="h-4 w-4 text-for-400" aria-hidden />
            <span className="text-xs font-mono font-semibold text-white">What are Relays?</span>
          </div>
          <p className="text-[11px] text-surface-500 leading-relaxed">
            A relay is a collaborative argument chain. One person starts it with a seed argument;
            up to {data?.items[0]?.relay_max_legs ?? 5} others each add one leg, building a collective case.
            When all legs are added, the community votes on whether the chain is compelling.
          </p>
          <Link
            href="/relays"
            className="inline-flex items-center gap-1 mt-2.5 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
          >
            Browse all relays
            <ChevronRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
