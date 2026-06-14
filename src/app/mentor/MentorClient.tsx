'use client'

/**
 * /mentor — The Civic Mentor Exchange
 *
 * Surfaces experienced citizens who can guide newer members. A mentor is any
 * citizen who has earned a named role (Debator, Troll Catcher, Elder) or who
 * has reached a meaningful engagement threshold (≥40 reputation, ≥30 votes,
 * ≥3 arguments).
 *
 * Distinct from:
 *   /coach        — AI argument critique tool (one-shot feedback)
 *   /skill-tree   — your personal progression map
 *   /missions     — daily engagement tasks
 *   /leaderboard  — all-time reputation ranking
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  Coins,
  Crown,
  ExternalLink,
  Flame,
  Loader2,
  MessageSquare,
  Mic,
  RefreshCw,
  Search,
  Shield,
  SlidersHorizontal,
  Star,
  ThumbsUp,
  Trophy,
  Users,
  Vote,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { RoleBadge } from '@/components/profile/RoleBadge'
import { cn } from '@/lib/utils/cn'
import type { MentorEntry, MentorResponse, MentorSort } from '@/app/api/mentor/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const SORT_OPTIONS: { value: MentorSort; label: string }[] = [
  { value: 'reputation', label: 'Top Reputation' },
  { value: 'clout',      label: 'Most Clout' },
  { value: 'votes',      label: 'Most Votes' },
  { value: 'arguments',  label: 'Best Debater' },
]

const ARCHETYPE_COLORS: Record<string, string> = {
  pragmatist:     'text-for-400',
  idealist:       'text-purple',
  guardian:       'text-emerald',
  reformer:       'text-against-400',
  libertarian:    'text-gold',
  communitarian:  'text-for-300',
  technocrat:     'text-surface-600',
  democrat:       'text-for-500',
}

// ─── Mentor Card ──────────────────────────────────────────────────────────────

function MentorCard({ mentor, isCurrentUser }: { mentor: MentorEntry; isCurrentUser: boolean }) {
  const archetypeLabel = mentor.civic_archetype
    ? mentor.civic_archetype.charAt(0).toUpperCase() + mentor.civic_archetype.slice(1)
    : null
  const archetypeColor = mentor.civic_archetype
    ? (ARCHETYPE_COLORS[mentor.civic_archetype] ?? 'text-surface-500')
    : 'text-surface-500'

  const shortenedBio = mentor.bio
    ? mentor.bio.length > 120 ? mentor.bio.slice(0, 117) + '…' : mentor.bio
    : null

  const topCats = mentor.category_preferences.slice(0, 3)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl bg-surface-100 border border-surface-300 p-5',
        'flex flex-col gap-4',
        'hover:border-surface-400 transition-colors'
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <Link href={`/profile/${mentor.username}`} className="flex-shrink-0">
          <Avatar
            src={mentor.avatar_url}
            fallback={mentor.display_name ?? mentor.username}
            size={48}
            className="ring-2 ring-surface-300 hover:ring-for-500/50 transition-all"
          />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/profile/${mentor.username}`}
                className="font-mono font-bold text-white hover:text-for-300 transition-colors truncate block"
              >
                {mentor.display_name ?? mentor.username}
              </Link>
              <p className="text-xs font-mono text-surface-500 truncate">@{mentor.username}</p>
            </div>
            <RoleBadge role={mentor.role as 'person' | 'debator' | 'troll_catcher' | 'elder'} size="sm" />
          </div>

          {archetypeLabel && (
            <p className={cn('text-[10px] font-mono mt-1', archetypeColor)}>
              {archetypeLabel}
            </p>
          )}
        </div>
      </div>

      {/* Bio */}
      {shortenedBio && (
        <p className="text-xs font-mono text-surface-600 leading-relaxed">{shortenedBio}</p>
      )}

      {/* Category tags */}
      {topCats.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {topCats.map((cat) => (
            <Badge
              key={cat}
              variant="subtle"
              size="xs"
              className="font-mono text-[10px] bg-for-500/10 text-for-400 border-for-500/20"
            >
              {cat}
            </Badge>
          ))}
          {mentor.category_preferences.length > 3 && (
            <Badge variant="subtle" size="xs" className="font-mono text-[10px] text-surface-500 border-surface-400/30">
              +{mentor.category_preferences.length - 3}
            </Badge>
          )}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 pt-1 border-t border-surface-300">
        <StatCell
          icon={<Star className="h-3 w-3 text-gold" />}
          value={Math.round(mentor.reputation_score)}
          label="REP"
        />
        <StatCell
          icon={<Coins className="h-3 w-3 text-emerald" />}
          value={mentor.clout.toLocaleString()}
          label="CLOUT"
        />
        <StatCell
          icon={<Vote className="h-3 w-3 text-for-400" />}
          value={mentor.total_votes.toLocaleString()}
          label="VOTES"
        />
        <StatCell
          icon={<MessageSquare className="h-3 w-3 text-purple" />}
          value={mentor.total_arguments.toLocaleString()}
          label="ARGS"
        />
      </div>

      {/* Followers + streak */}
      <div className="flex items-center gap-3 text-[10px] font-mono text-surface-500">
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {mentor.followers_count.toLocaleString()} followers
        </span>
        {mentor.vote_streak > 0 && (
          <span className="flex items-center gap-1 text-against-400">
            <Flame className="h-3 w-3" />
            {mentor.vote_streak}d streak
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto">
        {!isCurrentUser ? (
          <Link
            href={`/messages/${mentor.username}`}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-mono font-semibold',
              'bg-for-600 hover:bg-for-500 text-white transition-colors'
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Message
          </Link>
        ) : (
          <Link
            href="/profile/me"
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-mono font-semibold',
              'bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors'
            )}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Your Profile
          </Link>
        )}
        <Link
          href={`/profile/${mentor.username}`}
          className={cn(
            'flex items-center justify-center h-9 w-9 rounded-lg text-xs font-mono',
            'bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors'
          )}
          aria-label={`View ${mentor.display_name ?? mentor.username}'s profile`}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </motion.div>
  )
}

function StatCell({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: string | number
  label: string
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1">
        {icon}
        <span className="text-xs font-mono font-bold text-white">{value}</span>
      </div>
      <span className="text-[9px] font-mono text-surface-600 uppercase tracking-wide">{label}</span>
    </div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function MentorCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 flex-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="grid grid-cols-4 gap-2 pt-1 border-t border-surface-300">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-2.5 w-8" />
          </div>
        ))}
      </div>
      <Skeleton className="h-9 w-full rounded-lg" />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MentorClient() {
  const [mentors, setMentors]       = useState<MentorEntry[]>([])
  const [total, setTotal]           = useState(0)
  const [loading, setLoading]       = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [category, setCategory]     = useState<string | null>(null)
  const [sort, setSort]             = useState<MentorSort>('reputation')
  const [query, setQuery]           = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [offset, setOffset]         = useState(0)

  const LIMIT = 24
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasMounted = useRef(false)

  // Auth check
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null)
    })
  }, [])

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQ(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const fetchMentors = useCallback(async (reset: boolean) => {
    const nextOffset = reset ? 0 : offset
    if (reset) setLoading(true); else setLoadingMore(true)
    setError(null)

    const params = new URLSearchParams({ sort, limit: String(LIMIT), offset: String(nextOffset) })
    if (category) params.set('category', category)
    if (debouncedQ) params.set('q', debouncedQ)

    try {
      const res = await fetch(`/api/mentor?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load mentors')
      const data: MentorResponse = await res.json()

      setMentors((prev) => reset ? data.mentors : [...prev, ...data.mentors])
      setTotal(data.total)
      if (reset) setOffset(LIMIT); else setOffset(nextOffset + LIMIT)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [sort, category, debouncedQ, offset])

  // Initial + filter changes → reset
  useEffect(() => {
    if (hasMounted.current) {
      setOffset(0)
      fetchMentors(true)
    } else {
      hasMounted.current = true
      fetchMentors(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, category, debouncedQ])

  const hasMore = mentors.length < total

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <Link
            href="/"
            className="flex items-center justify-center h-10 w-10 rounded-xl bg-surface-200 border border-surface-300 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0 mt-0.5"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-gold/10 border border-gold/30">
                <Trophy className="h-4.5 w-4.5 text-gold" />
              </div>
              <h1 className="font-mono text-2xl font-bold text-white">Mentor Exchange</h1>
            </div>
            <p className="text-sm font-mono text-surface-500 leading-relaxed max-w-lg">
              Connect with experienced citizens — Debators, Troll Catchers, and Elders who&apos;ve
              earned their rank through real civic engagement. Learn from the best.
            </p>
          </div>
        </div>

        {/* Role legend */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <RoleLegendCard
            icon={<Mic className="h-4 w-4 text-for-400" />}
            bg="bg-for-500/10"
            border="border-for-500/20"
            role="Debator"
            desc="Earned through consistent argument quality and debate wins"
          />
          <RoleLegendCard
            icon={<Shield className="h-4 w-4 text-emerald" />}
            bg="bg-emerald/10"
            border="border-emerald/20"
            role="Troll Catcher"
            desc="Community moderators who maintain quality debate"
          />
          <RoleLegendCard
            icon={<Crown className="h-4 w-4 text-gold" />}
            bg="bg-gold/10"
            border="border-gold/20"
            role="Elder"
            desc="The most respected voices — long tenure, high impact"
          />
        </div>

        {/* Search + sort controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search by name, username, or bio…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={cn(
                'w-full pl-9 pr-9 h-10 rounded-xl text-sm font-mono',
                'bg-surface-200 border border-surface-300 text-white placeholder-surface-500',
                'focus:outline-none focus:border-for-500/50 focus:ring-1 focus:ring-for-500/30',
                'transition-colors'
              )}
              aria-label="Search mentors"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Sort */}
          <div className="relative">
            <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" aria-hidden="true" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as MentorSort)}
              className={cn(
                'pl-9 pr-8 h-10 rounded-xl text-sm font-mono appearance-none',
                'bg-surface-200 border border-surface-300 text-white',
                'focus:outline-none focus:border-for-500/50',
                'transition-colors cursor-pointer'
              )}
              aria-label="Sort mentors by"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" aria-hidden="true" />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              'flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-mono transition-colors',
              showFilters || category
                ? 'bg-for-600 text-white border border-for-500'
                : 'bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400'
            )}
            aria-expanded={showFilters}
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            Category
            {category && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
          </button>
        </div>

        {/* Category filter pills */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-surface-300">
                <button
                  onClick={() => setCategory(null)}
                  className={cn(
                    'h-8 px-3 rounded-lg text-xs font-mono transition-colors',
                    category === null
                      ? 'bg-for-600 text-white'
                      : 'bg-surface-200 border border-surface-300 text-surface-400 hover:text-white'
                  )}
                >
                  All Categories
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(category === cat ? null : cat)}
                    className={cn(
                      'h-8 px-3 rounded-lg text-xs font-mono transition-colors',
                      category === cat
                        ? 'bg-for-600 text-white'
                        : 'bg-surface-200 border border-surface-300 text-surface-400 hover:text-white'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results header */}
        {!loading && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-mono text-surface-500">
              {total > 0 ? (
                <>
                  <span className="text-white font-semibold">{total}</span> mentor{total !== 1 ? 's' : ''}
                  {category ? ` in ${category}` : ''}
                  {debouncedQ ? ` matching "${debouncedQ}"` : ''}
                </>
              ) : 'No mentors found'}
            </p>
            {(category || debouncedQ) && (
              <button
                onClick={() => { setCategory(null); setQuery('') }}
                className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 12 }).map((_, i) => <MentorCardSkeleton key={i} />)}
          </div>
        ) : error ? (
          <EmptyState
            icon={RefreshCw}
            title="Failed to load mentors"
            description={error}
            actions={[{ label: 'Try again', onClick: () => fetchMentors(true) }]}
          />
        ) : mentors.length === 0 ? (
          <EmptyState
            icon={Users}
            iconColor="text-for-400"
            iconBg="bg-for-500/10"
            iconBorder="border-for-500/20"
            title="No mentors found"
            description={
              debouncedQ || category
                ? 'Try adjusting your search or removing filters.'
                : 'Mentors appear as citizens earn named roles through engagement.'
            }
            actions={
              debouncedQ || category
                ? [{ label: 'Clear filters', onClick: () => { setCategory(null); setQuery('') } }]
                : [{ label: 'View leaderboard', href: '/leaderboard', variant: 'secondary' }]
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {mentors.map((mentor) => (
                <MentorCard
                  key={mentor.id}
                  mentor={mentor}
                  isCurrentUser={mentor.id === currentUserId}
                />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => fetchMentors(false)}
                  disabled={loadingMore}
                  className={cn(
                    'flex items-center gap-2 h-10 px-6 rounded-xl text-sm font-mono font-medium',
                    'bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
                    'transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {loadingMore ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Loading…</>
                  ) : (
                    <>Load more ({total - mentors.length} remaining)</>
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {/* Become a mentor callout */}
        {!loading && !error && (
          <div className={cn(
            'mt-10 rounded-2xl bg-surface-100 border border-surface-300 p-6',
            'flex flex-col sm:flex-row items-start sm:items-center gap-4'
          )}>
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
              <ThumbsUp className="h-5 w-5 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-mono font-bold text-white mb-1">Want to become a mentor?</p>
              <p className="text-sm font-mono text-surface-500 leading-relaxed">
                Mentors are citizens who&apos;ve earned their place through real civic engagement. Post
                quality arguments, vote consistently, help moderate debates, and climb the{' '}
                <Link href="/skill-tree" className="text-for-400 hover:text-for-300 transition-colors">skill tree</Link>.
                Once you earn a named role, you&apos;ll appear here automatically.
              </p>
            </div>
            <Link
              href="/skill-tree"
              className={cn(
                'flex-shrink-0 flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-mono font-semibold',
                'bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
                'transition-colors'
              )}
            >
              View Skill Tree
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}

// ─── Role Legend Card ─────────────────────────────────────────────────────────

function RoleLegendCard({
  icon, bg, border, role, desc,
}: {
  icon: React.ReactNode
  bg: string
  border: string
  role: string
  desc: string
}) {
  return (
    <div className={cn('rounded-xl border p-3.5 flex items-start gap-3', bg, border)}>
      <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0', bg, border)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-mono font-semibold text-white text-sm">{role}</p>
        <p className="text-xs font-mono text-surface-500 leading-relaxed mt-0.5">{desc}</p>
      </div>
    </div>
  )
}
