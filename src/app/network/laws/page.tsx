'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Gavel,
  MessageSquare,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  NetworkLawItem,
  NetworkLawRelation,
  NetworkLawsResponse,
} from '@/app/api/network/laws/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function establishedTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

// ─── Tab navigation ────────────────────────────────────────────────────────────

function NetworkTabs({ active }: { active: string }) {
  const tabs = [
    { label: 'Activity',     href: '/network' },
    { label: 'Topics',       href: '/network/topics' },
    { label: 'Votes',        href: '/network/votes' },
    { label: 'Arguments',    href: '/network/arguments' },
    { label: 'Achievements', href: '/network/achievements' },
    { label: 'Debates',      href: '/network/debates' },
    { label: 'Laws',         href: '/network/laws' },
    { label: 'Relays',       href: '/network/relays' },
    { label: 'People',       href: '/network/people' },
    { label: 'Coalitions',   href: '/network/coalitions' },
    { label: 'Predictions',  href: '/network/predictions' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-1 p-1 mb-4 mx-4 sm:mx-0 rounded-xl bg-surface-100 border border-surface-300 w-fit">
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

// ─── Filter pills ─────────────────────────────────────────────────────────────

type FilterType = 'all' | NetworkLawRelation

const FILTER_LABELS: Record<FilterType, string> = {
  all: 'All',
  proposed: 'Proposed',
  argued: 'Argued',
  voted: 'Voted',
}

// ─── Law card ─────────────────────────────────────────────────────────────────

function LawCard({ item, idx }: { item: NetworkLawItem; idx: number }) {
  const catColor = CATEGORY_COLOR[item.law.category ?? ''] ?? 'text-surface-500'
  const forPct   = Math.round(item.law.blue_pct ?? 50)
  const againstPct = 100 - forPct

  const relationLabel: Record<NetworkLawRelation, string> = {
    proposed: 'proposed',
    argued:   item.vote_side === 'blue' ? 'argued For' : 'argued Against',
    voted:    item.vote_side === 'blue' ? 'voted For' : 'voted Against',
  }

  const relationColor: Record<NetworkLawRelation, string> = {
    proposed: 'text-gold',
    argued:   item.vote_side === 'blue' ? 'text-for-400' : 'text-against-400',
    voted:    item.vote_side === 'blue' ? 'text-for-400' : 'text-against-400',
  }

  const RelationIcon = item.relation === 'argued'
    ? MessageSquare
    : item.relation === 'voted'
      ? (item.vote_side === 'blue' ? ThumbsUp : ThumbsDown)
      : Gavel

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.03, 0.4) }}
    >
      <div className="rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors p-4">
        {/* Actor row */}
        <div className="flex items-center gap-2 mb-3">
          <Link href={`/profile/${item.actor.username}`} className="flex items-center gap-2 group">
            <Avatar
              src={item.actor.avatar_url}
              fallback={item.actor.display_name || item.actor.username}
              size="sm"
            />
            <span className="text-xs font-mono font-semibold text-white group-hover:text-for-400 transition-colors">
              {item.actor.display_name || item.actor.username}
            </span>
          </Link>
          <span className="text-xs font-mono text-surface-500">·</span>
          <RelationIcon
            className={cn('h-3 w-3 shrink-0', relationColor[item.relation])}
            aria-hidden="true"
          />
          <span className={cn('text-xs font-mono', relationColor[item.relation])}>
            {relationLabel[item.relation]}
          </span>
          <span className="text-xs font-mono text-surface-600 ml-auto whitespace-nowrap">
            {relativeTime(item.acted_at)}
          </span>
        </div>

        {/* Law statement */}
        <Link href={`/law/${item.law.id}`} className="group block">
          <p className="text-sm font-medium text-white leading-snug group-hover:text-emerald transition-colors line-clamp-3 mb-2">
            {item.law.statement}
          </p>
        </Link>

        {/* Footer row */}
        <div className="flex items-center gap-2 flex-wrap">
          {item.law.category && (
            <span className={cn('text-[11px] font-mono font-medium', catColor)}>
              {item.law.category}
            </span>
          )}

          {/* Vote bar */}
          {item.law.total_votes && item.law.total_votes > 0 && (
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[10px] font-mono text-for-400">{forPct}%</span>
              <div className="w-16 h-1 rounded-full overflow-hidden bg-surface-300 flex">
                <div
                  className="h-full bg-for-500 rounded-l-full"
                  style={{ width: `${forPct}%` }}
                />
                <div
                  className="h-full bg-against-500 rounded-r-full"
                  style={{ width: `${againstPct}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-against-400">{againstPct}%</span>
            </div>
          )}

          {/* Established date */}
          <div className="flex items-center gap-1 text-[11px] font-mono text-emerald ml-auto">
            <Gavel className="h-3 w-3" aria-hidden="true" />
            <span>Established {establishedTime(item.law.established_at)}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Skeleton list ─────────────────────────────────────────────────────────────

function LawSkeletons() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-full shrink-0" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16 ml-2" />
            <Skeleton className="h-3 w-12 ml-auto" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-28 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NetworkLawsPage() {
  const router = useRouter()
  const [data, setData]         = useState<NetworkLawsResponse | null>(null)
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter]     = useState<FilterType>('all')
  const mountedRef               = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/network/laws?limit=60')
      if (res.status === 401) { router.push('/sign-in'); return }
      if (!res.ok) throw new Error('Failed to load')
      const json: NetworkLawsResponse = await res.json()
      if (mountedRef.current) setData(json)
    } catch {
      if (mountedRef.current) setData({ items: [], following_count: 0, is_empty: true })
    } finally {
      if (mountedRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])

  const handleRefresh = useCallback(() => { if (!refreshing) fetchData(true) }, [fetchData, refreshing])

  const filtered = data
    ? filter === 'all'
      ? data.items
      : data.items.filter((i) => i.relation === filter)
    : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-14">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center h-9 w-9 rounded-lg border border-surface-300 bg-surface-100 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald/10 border border-emerald/30">
                <Gavel className="h-4 w-4 text-emerald" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-base font-mono font-bold text-white leading-none">
                  Network Laws
                </h1>
                {data && !loading && (
                  <p className="text-[11px] font-mono text-surface-500 mt-0.5">
                    {data.following_count > 0
                      ? `Laws shaped by ${data.following_count} people you follow`
                      : 'Follow people to see their civic impact'}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/network"
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              Activity
            </Link>
            <span className="text-surface-700">·</span>
            <button
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-surface-300 bg-surface-100 text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', (loading || refreshing) && 'animate-spin')} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        <NetworkTabs active="/network/laws" />

        {/* Filter pills */}
        <div className="flex flex-wrap items-center gap-1.5 mb-5">
          {(Object.keys(FILTER_LABELS) as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1 text-xs font-mono rounded-full border transition-colors',
                filter === f
                  ? 'bg-emerald/10 border-emerald/40 text-emerald'
                  : 'bg-surface-200/60 border-surface-300/60 text-surface-400 hover:text-white',
              )}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <LawSkeletons />
        ) : data?.following_count === 0 ? (
          <EmptyState
            icon={Users}
            iconColor="text-for-400/60"
            iconBg="bg-for-600/10"
            iconBorder="border-for-500/20"
            title="Follow people to see their laws"
            description="When you follow other members, topics they proposed, argued for, or voted on that became law will appear here."
            actions={[
              { label: 'Find people', href: '/search?tab=people', icon: Users },
              { label: 'Leaderboard', href: '/leaderboard', icon: Gavel, variant: 'secondary' },
            ]}
            size="lg"
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Gavel}
            iconColor="text-surface-500"
            iconBg="bg-surface-300/30"
            iconBorder="border-surface-400/20"
            title={filter === 'all' ? 'No established laws yet' : `No laws via "${FILTER_LABELS[filter]}" yet`}
            description={
              filter === 'all'
                ? 'Laws shaped by people you follow will appear here once topics pass the consensus threshold.'
                : 'Try a different filter to see more results.'
            }
            actions={filter !== 'all' ? [{ label: 'Show all', onClick: () => setFilter('all'), icon: Gavel }] : []}
            size="md"
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {filtered.map((item, idx) => (
                <LawCard key={item.key} item={item} idx={idx} />
              ))}
            </div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
