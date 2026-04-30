'use client'

/**
 * /citizens — The Citizen Directory
 *
 * Browse all citizens on the platform. Filter by role, sort by any civic
 * stat, and search by name. Follow users directly from the directory.
 *
 * Distinct from /leaderboard (top-N ranking), /rivals (vote opposites),
 * /twins (vote matches), and /discover (algorithmic suggestions) — this is
 * the full, browsable community roster.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowUpDown,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  Coins,
  Flame,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Shield,
  Star,
  ThumbsUp,
  UserCheck,
  UserPlus,
  Users,
  Zap,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CitizenRow, CitizensResponse } from '@/app/api/citizens/route'

// ─── Role config ──────────────────────────────────────────────────────────────

interface RoleConfig {
  label: string
  color: string
  bg: string
  border: string
  icon: typeof Shield
}

const ROLE_CONFIG: Record<string, RoleConfig> = {
  elder:        { label: 'Elder',        color: 'text-gold',       bg: 'bg-gold/10',       border: 'border-gold/40',       icon: Star },
  senator:      { label: 'Senator',      color: 'text-purple',     bg: 'bg-purple/10',     border: 'border-purple/40',     icon: Shield },
  lawmaker:     { label: 'Lawmaker',     color: 'text-gold',       bg: 'bg-gold/20',       border: 'border-gold/60',       icon: Zap },
  debator:      { label: 'Debator',      color: 'text-for-300',    bg: 'bg-for-500/10',    border: 'border-for-500/40',    icon: MessageSquare },
  troll_catcher:{ label: 'Troll Catcher',color: 'text-emerald',    bg: 'bg-emerald/10',    border: 'border-emerald/40',    icon: Shield },
  person:       { label: 'Citizen',      color: 'text-surface-400',bg: 'bg-surface-300/20',border: 'border-surface-400/30',icon: Users },
}

const ROLE_TABS = [
  { id: '',             label: 'All Citizens' },
  { id: 'elder',        label: 'Elders' },
  { id: 'senator',      label: 'Senators' },
  { id: 'lawmaker',     label: 'Lawmakers' },
  { id: 'debator',      label: 'Debators' },
  { id: 'troll_catcher',label: 'Troll Catchers' },
  { id: 'person',       label: 'Citizens' },
]

const SORT_OPTIONS = [
  { id: 'reputation', label: 'Reputation' },
  { id: 'votes',      label: 'Votes' },
  { id: 'clout',      label: 'Clout' },
  { id: 'streak',     label: 'Streak' },
  { id: 'newest',     label: 'Newest' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function joinedAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d < 1) return 'today'
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

// ─── Citizen card ─────────────────────────────────────────────────────────────

interface CitizenCardProps {
  citizen: CitizenRow
  currentUserId: string | null
  followingSet: Set<string>
  onFollowToggle: (id: string, username: string) => Promise<void>
}

function CitizenCard({ citizen, currentUserId, followingSet, onFollowToggle }: CitizenCardProps) {
  const [busy, setBusy] = useState(false)
  const role = ROLE_CONFIG[citizen.role] ?? ROLE_CONFIG.person
  const RoleIcon = role.icon
  const isFollowing = followingSet.has(citizen.id)
  const isSelf = currentUserId === citizen.id

  async function handleFollow(e: React.MouseEvent) {
    e.preventDefault()
    if (busy || isSelf) return
    setBusy(true)
    try {
      await onFollowToggle(citizen.id, citizen.username)
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative rounded-2xl bg-surface-100 border border-surface-300/60 hover:border-surface-400/70 transition-colors overflow-hidden"
    >
      <Link href={`/profile/${citizen.username}`} className="block p-4">
        {/* Top row: avatar + name + role */}
        <div className="flex items-start gap-3 mb-3">
          <Avatar
            src={citizen.avatar_url}
            fallback={citizen.display_name || citizen.username}
            size="lg"
            className="flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-bold text-white truncate">
                {citizen.display_name || citizen.username}
              </span>
              {citizen.is_influencer && (
                <Star className="h-3 w-3 text-gold flex-shrink-0" aria-label="Influencer" />
              )}
            </div>
            <span className="block text-xs font-mono text-surface-500 truncate">
              @{citizen.username}
            </span>
            {/* Role badge */}
            <span
              className={cn(
                'mt-1.5 inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border',
                role.color, role.bg, role.border,
              )}
            >
              <RoleIcon className="h-2.5 w-2.5" />
              {role.label}
            </span>
          </div>
        </div>

        {/* Bio snippet */}
        {citizen.bio && (
          <p className="text-[11px] text-surface-500 line-clamp-2 mb-3 leading-relaxed">
            {citizen.bio}
          </p>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-1.5">
          <div className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg bg-surface-200/60">
            <BarChart2 className="h-3 w-3 text-for-400" />
            <span className="text-[10px] font-mono font-bold text-white">
              {formatNumber(Math.round(citizen.reputation_score))}
            </span>
            <span className="text-[9px] font-mono text-surface-600">REP</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg bg-surface-200/60">
            <ThumbsUp className="h-3 w-3 text-for-400" />
            <span className="text-[10px] font-mono font-bold text-white">
              {formatNumber(citizen.total_votes)}
            </span>
            <span className="text-[9px] font-mono text-surface-600">VOTES</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg bg-surface-200/60">
            <Coins className="h-3 w-3 text-gold" />
            <span className="text-[10px] font-mono font-bold text-white">
              {formatNumber(citizen.clout)}
            </span>
            <span className="text-[9px] font-mono text-surface-600">CLOUT</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg bg-surface-200/60">
            <Flame className="h-3 w-3 text-against-400" />
            <span className="text-[10px] font-mono font-bold text-white">
              {citizen.vote_streak}
            </span>
            <span className="text-[9px] font-mono text-surface-600">STREAK</span>
          </div>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-300/40">
          <div className="flex items-center gap-2 text-[10px] font-mono text-surface-600">
            <Users className="h-2.5 w-2.5" />
            <span>{formatNumber(citizen.followers_count)} followers</span>
            <span>·</span>
            <span>joined {joinedAgo(citizen.created_at)}</span>
          </div>
        </div>
      </Link>

      {/* Follow button — outside the Link to avoid nested interactives */}
      {!isSelf && (
        <button
          onClick={handleFollow}
          disabled={busy}
          aria-label={isFollowing ? `Unfollow @${citizen.username}` : `Follow @${citizen.username}`}
          className={cn(
            'absolute top-3 right-3 flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-mono font-semibold',
            'border transition-all disabled:opacity-50',
            isFollowing
              ? 'bg-surface-300 border-surface-400 text-white hover:bg-against-500/20 hover:border-against-500/40 hover:text-against-400'
              : 'bg-for-600/20 border-for-500/40 text-for-300 hover:bg-for-600/30',
          )}
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : isFollowing ? (
            <UserCheck className="h-3 w-3" />
          ) : (
            <UserPlus className="h-3 w-3" />
          )}
          {isFollowing ? 'Following' : 'Follow'}
        </button>
      )}
    </motion.div>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function CitizenSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-14 w-14 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-4 w-1/3 rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CitizensPage() {
  const [citizens, setCitizens] = useState<CitizenRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [role, setRole] = useState('')
  const [sort, setSort] = useState('reputation')
  const [query, setQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)

  // Follow state
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set())

  const LIMIT = 24

  // Load current user id
  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setCurrentUserId(user.id)
      })
    })
  }, [])

  // Close sort menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSortMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchCitizens = useCallback(async (
    r: string,
    s: string,
    q: string,
    p: number,
  ) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        sort: s,
        page: String(p),
        limit: String(LIMIT),
      })
      if (r) params.set('role', r)
      if (q.length >= 2) params.set('q', q)

      const res = await fetch(`/api/citizens?${params}`)
      if (!res.ok) throw new Error('Failed to load')
      const data: CitizensResponse = await res.json()

      if (p === 1) {
        setCitizens(data.citizens)
      } else {
        setCitizens((prev) => [...prev, ...data.citizens])
      }
      setTotal(data.total)
      setHasMore(data.has_more)
    } catch {
      setError('Failed to load citizens')
    } finally {
      setLoading(false)
    }
  }, [])

  // Refetch when filters change
  useEffect(() => {
    setPage(1)
    fetchCitizens(role, sort, query, 1)
  }, [role, sort, query, fetchCitizens])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  async function handleFollowToggle(targetId: string, _username: string) {
    const wasFollowing = followingSet.has(targetId)
    setFollowingSet((prev) => {
      const next = new Set(prev)
      if (wasFollowing) next.delete(targetId)
      else next.add(targetId)
      return next
    })

    try {
      const method = wasFollowing ? 'DELETE' : 'POST'
      const res = await fetch('/api/follow', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: targetId }),
      })
      if (!res.ok) throw new Error('Follow failed')
    } catch {
      // Revert optimistic update
      setFollowingSet((prev) => {
        const next = new Set(prev)
        if (wasFollowing) next.add(targetId)
        else next.delete(targetId)
        return next
      })
    }
  }

  function loadMore() {
    const next = page + 1
    setPage(next)
    fetchCitizens(role, sort, query, next)
  }

  const activeSortLabel =
    SORT_OPTIONS.find((o) => o.id === sort)?.label ?? 'Reputation'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-6xl mx-auto px-4 pt-6 pb-24 md:pb-10">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="mb-6 space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-for-600/15 border border-for-500/30 flex items-center justify-center flex-shrink-0">
              <Users className="h-4.5 w-4.5 text-for-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-mono text-2xl font-bold text-white">Citizen Directory</h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Browse every voice in the Lobby
                {total > 0 && !loading && (
                  <span className="text-surface-600"> · {total.toLocaleString()} registered</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* ── Search + Sort bar ───────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name or username…"
              aria-label="Search citizens"
              className={cn(
                'w-full h-9 pl-9 pr-8 rounded-xl bg-surface-200 border border-surface-300',
                'text-sm text-white placeholder-surface-600',
                'focus:outline-none focus:border-for-500/50 focus:ring-1 focus:ring-for-500/20',
                'transition-colors',
              )}
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Sort dropdown */}
          <div className="relative flex-shrink-0" ref={sortRef}>
            <button
              onClick={() => setShowSortMenu((s) => !s)}
              className={cn(
                'flex items-center gap-1.5 h-9 px-3 rounded-xl bg-surface-200 border border-surface-300',
                'text-xs font-mono text-surface-400 hover:text-white transition-colors',
                showSortMenu && 'border-surface-400 text-white',
              )}
            >
              <ArrowUpDown className="h-3 w-3" />
              <span className="hidden sm:inline">{activeSortLabel}</span>
            </button>

            <AnimatePresence>
              {showSortMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-11 z-20 w-36 rounded-xl bg-surface-100 border border-surface-300 shadow-xl overflow-hidden"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => { setSort(opt.id); setShowSortMenu(false) }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs font-mono transition-colors',
                        sort === opt.id
                          ? 'bg-for-600/20 text-for-300'
                          : 'text-surface-400 hover:bg-surface-200 hover:text-white',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Refresh */}
          <button
            onClick={() => fetchCitizens(role, sort, query, 1)}
            aria-label="Refresh"
            disabled={loading}
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-surface-200 border border-surface-300 text-surface-500 hover:text-white transition-colors flex-shrink-0 disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Role tabs ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5 mb-5">
          {ROLE_TABS.map((tab) => {
            const cfg = tab.id ? ROLE_CONFIG[tab.id] : null
            const isActive = role === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setRole(tab.id)}
                className={cn(
                  'flex-shrink-0 h-8 px-3 rounded-lg text-xs font-mono font-semibold border transition-all',
                  isActive
                    ? cfg
                      ? `${cfg.color} ${cfg.bg} ${cfg.border}`
                      : 'bg-for-600/20 border-for-500/40 text-for-300'
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white',
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* ── Content ─────────────────────────────────────────────────── */}
        {error ? (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/5 p-8 text-center">
            <p className="text-sm font-mono text-against-400">{error}</p>
            <button
              onClick={() => fetchCitizens(role, sort, query, 1)}
              className="mt-3 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              Try again
            </button>
          </div>
        ) : loading && citizens.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <CitizenSkeleton key={i} />
            ))}
          </div>
        ) : citizens.length === 0 ? (
          <EmptyState
            icon={Users}
            title={query ? 'No citizens found' : 'No citizens yet'}
            description={
              query
                ? `No citizens match "${query}". Try a different search term.`
                : role
                ? `No ${ROLE_CONFIG[role]?.label ?? role}s yet on the platform.`
                : 'The Lobby is empty. Be the first to join!'
            }
            action={
              (query || role) ? (
                <button
                  onClick={() => { setSearchInput(''); setRole('') }}
                  className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
                >
                  Clear filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Result count */}
            <p className="text-[11px] font-mono text-surface-600 mb-4">
              {query
                ? `${total} result${total !== 1 ? 's' : ''} for "${query}"`
                : `${total.toLocaleString()} citizen${total !== 1 ? 's' : ''}${role ? ` · ${ROLE_CONFIG[role]?.label ?? role}s` : ''}`}
            </p>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {citizens.map((c) => (
                  <CitizenCard
                    key={c.id}
                    citizen={c}
                    currentUserId={currentUserId}
                    followingSet={followingSet}
                    onFollowToggle={handleFollowToggle}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className={cn(
                    'flex items-center gap-2 h-10 px-6 rounded-xl border border-surface-300',
                    'text-sm font-mono text-surface-400 bg-surface-200',
                    'hover:border-surface-400 hover:text-white transition-colors',
                    'disabled:opacity-50',
                  )}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <ChevronLeft className="h-3.5 w-3.5 rotate-180" aria-hidden />
                      Load more ({total - citizens.length} remaining)
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
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
