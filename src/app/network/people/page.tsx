'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  Loader2,
  RefreshCw,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { NetworkPerson, NetworkPeopleResponse } from '@/app/api/network/people/route'

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
    { label: 'People',       href: '/network/people' },
    { label: 'Coalitions',   href: '/network/coalitions' },
    { label: 'Predictions',  href: '/network/predictions' },
    { label: 'Relays',       href: '/network/relays' },
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

// ─── Section filter ───────────────────────────────────────────────────────────

type PeopleSection = 'following' | 'followers' | 'suggestions'

const SECTION_LABELS: Record<PeopleSection, string> = {
  following:   'Following',
  followers:   'Followers',
  suggestions: 'Suggested',
}

// ─── Follow button ────────────────────────────────────────────────────────────

function FollowButton({ person, onToggle }: {
  person: NetworkPerson
  onToggle: (id: string, nowFollowing: boolean) => void
}) {
  const [busy, setBusy] = useState(false)

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    try {
      await fetch('/api/follow', {
        method: person.is_following ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: person.id }),
      })
      onToggle(person.id, !person.is_following)
    } catch {
      // best-effort
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-label={person.is_following ? `Unfollow @${person.username}` : `Follow @${person.username}`}
      className={cn(
        'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
        'border transition-all duration-150 disabled:opacity-50',
        person.is_following
          ? 'bg-for-600/20 border-for-600/50 text-for-400 hover:bg-against-500/10 hover:border-against-500/40 hover:text-against-400'
          : 'bg-surface-300 border-surface-400 text-white hover:bg-for-600 hover:border-for-600'
      )}
    >
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : person.is_following ? (
        <>
          <Check className="h-3 w-3" />
          Following
        </>
      ) : (
        <>
          <UserPlus className="h-3 w-3" />
          Follow
        </>
      )}
    </button>
  )
}

// ─── Person card ──────────────────────────────────────────────────────────────

function PersonCard({
  person,
  showFollowedAt,
  onToggle,
}: {
  person: NetworkPerson
  showFollowedAt?: boolean
  onToggle: (id: string, nowFollowing: boolean) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'flex items-center gap-3 p-4 rounded-xl',
        'bg-surface-100 border border-surface-300',
        'hover:border-surface-400 transition-colors group'
      )}
    >
      <Link href={`/profile/${person.username}`} className="flex items-center gap-3 flex-1 min-w-0">
        <div className="relative flex-shrink-0">
          <Avatar
            src={person.avatar_url}
            fallback={person.display_name || person.username}
            size="md"
          />
          {person.mutual && (
            <span
              className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center h-4 w-4 rounded-full bg-surface-100 border border-surface-300"
              title="Mutual follow"
            >
              <UserCheck className="h-2.5 w-2.5 text-emerald" />
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white group-hover:text-for-400 transition-colors truncate">
              {person.display_name || person.username}
            </p>
            <Badge variant={person.role as 'person' | 'debator' | 'troll_catcher' | 'elder'}>
              {person.role}
            </Badge>
          </div>
          <p className="text-xs text-surface-500 truncate">@{person.username}</p>
          {person.bio && (
            <p className="text-xs text-surface-600 mt-0.5 line-clamp-1">{person.bio}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-gold">
              <Zap className="h-3 w-3" />
              {person.clout.toLocaleString()} clout
            </span>
            <span className="flex items-center gap-1 text-xs text-surface-500">
              <TrendingUp className="h-3 w-3" />
              {person.total_votes.toLocaleString()} votes
            </span>
            {person.vote_streak > 0 && (
              <span className="text-xs text-against-400 font-mono">
                🔥 {person.vote_streak}d streak
              </span>
            )}
            {showFollowedAt && person.followed_at && (
              <span className="text-[10px] font-mono text-surface-600 ml-auto">
                {relativeTime(person.followed_at)}
              </span>
            )}
          </div>
        </div>
      </Link>
      <FollowButton person={person} onToggle={onToggle} />
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PersonCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-100 border border-surface-300 animate-pulse">
      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-8 w-20 rounded-lg flex-shrink-0" />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NetworkPeoplePage() {
  const router = useRouter()
  const [data, setData] = useState<NetworkPeopleResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [section, setSection] = useState<PeopleSection>('following')
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async (silent = false) => {
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)

    try {
      const res = await fetch('/api/network/people?limit=30', {
        signal: abortRef.current.signal,
      })
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as NetworkPeopleResponse
      setData(json)
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return
      setError('Failed to load people. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    return () => abortRef.current?.abort()
  }, [load])

  // Update a person's is_following state after toggling
  function handleToggle(id: string, nowFollowing: boolean) {
    if (!data) return
    function updateList(list: NetworkPerson[]): NetworkPerson[] {
      return list.map((p) =>
        p.id === id ? { ...p, is_following: nowFollowing, mutual: nowFollowing && p.mutual } : p
      )
    }
    setData({
      ...data,
      following: updateList(data.following),
      followers: updateList(data.followers),
      suggestions: updateList(data.suggestions),
    })
  }

  const activeList: NetworkPerson[] =
    section === 'following'
      ? data?.following ?? []
      : section === 'followers'
      ? data?.followers ?? []
      : data?.suggestions ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
              <Users className="h-4.5 w-4.5 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-lg font-bold text-white leading-tight">Network People</h1>
              {data && !loading && (
                <p className="text-xs font-mono text-surface-500">
                  {data.following_count} following · {data.follower_count} followers
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh"
            className="ml-auto flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Network tabs */}
        <NetworkTabs active="/network/people" />

        {/* Section pills */}
        <div className="flex items-center gap-1.5 mb-5 flex-wrap" role="tablist" aria-label="People sections">
          {(['following', 'followers', 'suggestions'] as PeopleSection[]).map((s) => {
            const count =
              s === 'following'
                ? data?.following_count
                : s === 'followers'
                ? data?.follower_count
                : data?.suggestions.length
            return (
              <button
                key={s}
                role="tab"
                aria-selected={section === s}
                onClick={() => setSection(s)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors',
                  section === s
                    ? 'bg-purple/10 border-purple/40 text-purple'
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                )}
              >
                {SECTION_LABELS[s]}
                {count !== undefined && (
                  <span className={cn(
                    'flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold leading-none',
                    section === s ? 'bg-purple/20 text-purple' : 'bg-surface-300 text-surface-500'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <PersonCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={Users}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/30"
            title="Failed to load"
            description={error}
            actions={[{ label: 'Try again', onClick: () => load() }]}
          />
        ) : data?.is_empty && section !== 'suggestions' ? (
          <EmptyState
            icon={UserPlus}
            iconColor="text-purple"
            iconBg="bg-purple/10"
            iconBorder="border-purple/30"
            title="No connections yet"
            description="Follow citizens to see their votes, arguments, and achievements here."
            actions={[{ label: 'Discover people', href: '/search?tab=people' }]}
          />
        ) : activeList.length === 0 ? (
          <EmptyState
            icon={Users}
            iconColor="text-surface-500"
            iconBg="bg-surface-200"
            iconBorder="border-surface-300"
            title={
              section === 'following'
                ? 'Not following anyone yet'
                : section === 'followers'
                ? 'No followers yet'
                : 'No suggestions'
            }
            description={
              section === 'following'
                ? 'Follow citizens to build your network and see their activity.'
                : section === 'followers'
                ? 'When citizens follow you, they\'ll appear here.'
                : 'You\'re already following everyone we\'d suggest!'
            }
            actions={
              section !== 'followers'
                ? [{ label: 'Search for people', href: '/search?tab=people' }]
                : []
            }
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
              role="feed"
              aria-label={`${SECTION_LABELS[section]} list`}
            >
              {activeList.map((person) => (
                <PersonCard
                  key={person.id}
                  person={person}
                  showFollowedAt={section !== 'suggestions'}
                  onToggle={handleToggle}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
