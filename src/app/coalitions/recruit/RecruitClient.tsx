'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  Crown,
  ExternalLink,
  Flame,
  Loader2,
  Lock,
  RefreshCw,
  Shield,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { RecruitCoalition, RecruitResponse } from '@/app/api/coalitions/recruit/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type SortMode = 'active' | 'newest' | 'open' | 'small'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d < 1) return 'today'
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

function spotsLabel(open: number): string {
  if (open === 1) return '1 spot left'
  if (open <= 5) return `${open} spots left`
  if (open <= 20) return `${open} spots`
  return `${open}+ spots`
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

function sortCoalitions(list: RecruitCoalition[], mode: SortMode): RecruitCoalition[] {
  return [...list].sort((a, b) => {
    if (mode === 'active') return b.coalition_influence - a.coalition_influence
    if (mode === 'newest') return b.created_at.localeCompare(a.created_at)
    if (mode === 'open') return b.open_spots - a.open_spots
    if (mode === 'small') return a.member_count - b.member_count
    return 0
  })
}

// ─── Recruit Card ─────────────────────────────────────────────────────────────

function CoalitionRecruitCard({ coalition }: { coalition: RecruitCoalition }) {
  const [joinState, setJoinState] = useState<'idle' | 'joining' | 'joined' | 'requested' | 'requesting' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const totalMatches = coalition.wins + coalition.losses
  const winRate = totalMatches > 0 ? Math.round((coalition.wins / totalMatches) * 100) : null
  const fillPct = Math.round((coalition.member_count / coalition.max_members) * 100)
  const isFresh = coalition.stance_count === 0

  async function handleJoin() {
    if (joinState !== 'idle') return
    setJoinState(coalition.is_public ? 'joining' : 'requesting')
    setErrorMsg(null)

    try {
      const endpoint = coalition.is_public
        ? `/api/coalitions/${coalition.id}/join`
        : `/api/coalitions/${coalition.id}/join-request`

      const res = await fetch(endpoint, { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409) {
          setJoinState(coalition.is_public ? 'joined' : 'requested')
        } else {
          setErrorMsg(data.error ?? 'Something went wrong')
          setJoinState('error')
        }
        return
      }

      setJoinState(coalition.is_public ? 'joined' : 'requested')
    } catch {
      setErrorMsg('Network error — please try again')
      setJoinState('error')
    }
  }

  const btnLabel = {
    idle: coalition.is_public ? 'Join Coalition' : 'Request Access',
    joining: 'Joining…',
    requesting: 'Requesting…',
    joined: 'Joined!',
    requested: 'Request Sent',
    error: 'Try Again',
  }[joinState]

  const btnClass = {
    idle: coalition.is_public
      ? 'bg-for-600/20 border-for-600/40 text-for-300 hover:bg-for-600/30 hover:text-white'
      : 'bg-purple/10 border-purple/30 text-purple hover:bg-purple/20 hover:text-white',
    joining: 'bg-surface-200 border-surface-300 text-surface-500 cursor-not-allowed',
    requesting: 'bg-surface-200 border-surface-300 text-surface-500 cursor-not-allowed',
    joined: 'bg-emerald/10 border-emerald/30 text-emerald cursor-default',
    requested: 'bg-purple/10 border-purple/30 text-purple cursor-default',
    error: 'bg-against-500/10 border-against-500/30 text-against-400 hover:bg-against-500/20',
  }[joinState]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5 hover:border-purple/30 transition-colors group"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
          <Users className="h-5 w-5 text-purple" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/coalitions/${coalition.id}`}
              className="font-mono text-base font-bold text-white hover:text-purple transition-colors truncate"
            >
              {coalition.name}
            </Link>
            {!coalition.is_public && (
              <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-200 border border-surface-300 text-surface-500">
                <Lock className="h-2.5 w-2.5" />
                Private
              </span>
            )}
            {isFresh && (
              <Badge variant="outline" className="text-[10px] font-mono border-gold/30 text-gold bg-gold/5">
                New
              </Badge>
            )}
          </div>
          {coalition.creator && (
            <p className="text-xs font-mono text-surface-500 mt-0.5 truncate">
              Led by{' '}
              <Link
                href={`/profile/${coalition.creator.username}`}
                className="hover:text-white transition-colors"
              >
                @{coalition.creator.username}
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* Description */}
      {coalition.description && (
        <p className="text-sm text-surface-600 leading-relaxed mb-4 line-clamp-2">
          {coalition.description}
        </p>
      )}
      {!coalition.description && (
        <p className="text-sm text-surface-700 italic mb-4">No mission statement yet.</p>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
          <Users className="h-3.5 w-3.5" />
          <span>{coalition.member_count}/{coalition.max_members}</span>
        </div>

        {winRate !== null && (
          <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
            <Trophy className="h-3.5 w-3.5 text-gold" />
            <span className="text-gold font-semibold">{winRate}%</span>
            <span>win rate</span>
          </div>
        )}

        {coalition.coalition_influence > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
            <Zap className="h-3.5 w-3.5 text-gold" />
            <span>{Math.round(coalition.coalition_influence).toLocaleString()} influence</span>
          </div>
        )}

        {coalition.stance_count > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
            <Shield className="h-3.5 w-3.5 text-for-400" />
            <span>{coalition.stance_count} stance{coalition.stance_count !== 1 ? 's' : ''}</span>
          </div>
        )}

        <div className="ml-auto text-[10px] font-mono text-surface-600">
          Founded {relativeTime(coalition.created_at)}
        </div>
      </div>

      {/* Capacity bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono text-surface-500">Capacity</span>
          <span className={cn(
            'text-[10px] font-mono font-semibold',
            coalition.open_spots <= 5 ? 'text-against-400' : 'text-emerald',
          )}>
            {spotsLabel(coalition.open_spots)}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              fillPct >= 90 ? 'bg-against-500' : fillPct >= 70 ? 'bg-gold' : 'bg-emerald',
            )}
            style={{ width: `${fillPct}%` }}
          />
        </div>
      </div>

      {/* CTA row */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleJoin}
          disabled={joinState === 'joined' || joinState === 'requested' || joinState === 'joining' || joinState === 'requesting'}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono font-semibold border transition-all',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/40',
            btnClass,
          )}
        >
          {(joinState === 'joining' || joinState === 'requesting') && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          {joinState === 'joined' && <CheckCircle2 className="h-3.5 w-3.5" />}
          {joinState === 'requested' && <Sparkles className="h-3.5 w-3.5" />}
          {!coalition.is_public && joinState === 'idle' && <Lock className="h-3.5 w-3.5" />}
          {btnLabel}
        </button>

        <Link
          href={`/coalitions/${coalition.id}`}
          className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
        >
          View coalition
          <ExternalLink className="h-3 w-3" />
        </Link>

        {errorMsg && (
          <span className="text-xs font-mono text-against-400 truncate flex-1">{errorMsg}</span>
        )}
      </div>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-3/4" />
      <div className="flex gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <Skeleton className="h-9 w-36 rounded-xl" />
    </div>
  )
}

// ─── Sort tabs ────────────────────────────────────────────────────────────────

const SORT_TABS: { id: SortMode; label: string; icon: typeof Flame }[] = [
  { id: 'active',  label: 'Most Active', icon: Flame  },
  { id: 'newest',  label: 'Newest',      icon: Sparkles },
  { id: 'open',    label: 'Most Open',   icon: Users   },
  { id: 'small',   label: 'Smallest',    icon: Crown   },
]

// ─── Main component ───────────────────────────────────────────────────────────

export function RecruitClient() {
  const [data, setData] = useState<RecruitCoalition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [sort, setSort] = useState<SortMode>('active')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/coalitions/recruit')
      if (!res.ok) throw new Error('fetch failed')
      const json: RecruitResponse = await res.json()
      setData(json.coalitions)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const sorted = useMemo(() => {
    const filtered = search.trim()
      ? data.filter((c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.description ?? '').toLowerCase().includes(search.toLowerCase()),
        )
      : data
    return sortCoalitions(filtered, sort)
  }, [data, sort, search])

  const publicCount  = data.filter((c) => c.is_public).length
  const privateCount = data.filter((c) => !c.is_public).length

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/coalitions"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to coalitions"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white font-mono">Coalition Recruiting</h1>
            <p className="text-xs text-surface-500 mt-0.5">
              Find your political alliance — alliances actively seeking new members
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white disabled:opacity-50 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Stats strip */}
        {!loading && !error && data.length > 0 && (
          <div className="flex items-center gap-4 mb-5 p-3 rounded-xl bg-surface-100 border border-surface-300">
            <div className="text-center">
              <p className="text-lg font-bold font-mono text-white">{data.length}</p>
              <p className="text-[10px] font-mono text-surface-500">open coalitions</p>
            </div>
            <div className="w-px h-8 bg-surface-300" />
            <div className="text-center">
              <p className="text-lg font-bold font-mono text-for-400">{publicCount}</p>
              <p className="text-[10px] font-mono text-surface-500">join instantly</p>
            </div>
            <div className="w-px h-8 bg-surface-300" />
            <div className="text-center">
              <p className="text-lg font-bold font-mono text-purple">{privateCount}</p>
              <p className="text-[10px] font-mono text-surface-500">request access</p>
            </div>
            <div className="w-px h-8 bg-surface-300 hidden sm:block" />
            <p className="hidden sm:block text-xs font-mono text-surface-500 flex-1">
              Public coalitions are open to all. Private coalitions require leader approval.
            </p>
          </div>
        )}

        {/* Search + sort */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <input
            type="text"
            placeholder="Search coalitions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-surface-100 border border-surface-300 rounded-xl px-4 py-2.5 text-sm font-mono text-white placeholder:text-surface-600 focus:outline-none focus:border-purple/50 focus:ring-1 focus:ring-purple/20"
          />
          <div className="flex items-center gap-1 flex-shrink-0">
            {SORT_TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSort(id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-mono transition-colors',
                  sort === id
                    ? 'bg-purple/15 border border-purple/30 text-purple'
                    : 'bg-surface-100 border border-surface-300 text-surface-500 hover:text-white',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <p className="text-surface-500 font-mono text-sm">Failed to load recruiting board.</p>
            <button
              onClick={load}
              className="flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? 'No matching coalitions' : 'No coalitions recruiting right now'}
            description={
              search
                ? 'Try a different search term.'
                : 'All coalitions are at capacity. Check back later or create your own.'
            }
            action={
              !search
                ? { label: 'Create a coalition', href: '/coalitions/create' }
                : undefined
            }
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-4">
              {sorted.map((c) => (
                <CoalitionRecruitCard key={c.id} coalition={c} />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Footer CTA */}
        {!loading && !error && data.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-sm font-mono text-surface-500 mb-3">
              Don&rsquo;t see the right fit?
            </p>
            <Link
              href="/coalitions/create"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple/15 border border-purple/30 text-purple text-sm font-mono font-semibold hover:bg-purple/25 hover:text-white transition-all"
            >
              <Sparkles className="h-4 w-4" />
              Found your own coalition
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
