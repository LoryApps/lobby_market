'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  Scroll,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { Thesis, ThesisStatus } from '@/lib/types/thesis'
import type { FollowingThesisResponse } from '@/app/api/thesis/following/route'

// ─── Config ───────────────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  economics:   'text-gold border-gold/40 bg-gold/10',
  politics:    'text-for-400 border-for-500/40 bg-for-500/10',
  technology:  'text-purple border-purple/40 bg-purple/10',
  science:     'text-emerald border-emerald/40 bg-emerald/10',
  ethics:      'text-against-400 border-against-500/40 bg-against-500/10',
  philosophy:  'text-surface-400 border-surface-400/40 bg-surface-300/20',
  culture:     'text-pink-400 border-pink-500/40 bg-pink-500/10',
  health:      'text-green-400 border-green-500/40 bg-green-500/10',
  environment: 'text-teal-400 border-teal-500/40 bg-teal-500/10',
  education:   'text-indigo-400 border-indigo-500/40 bg-indigo-500/10',
}

const STATUS_CONFIG: Record<ThesisStatus, { label: string; color: string; icon: typeof Zap }> = {
  active:     { label: 'Active',     color: 'text-for-400',    icon: Zap },
  vindicated: { label: 'Vindicated', color: 'text-gold',       icon: Trophy },
  refuted:    { label: 'Refuted',    color: 'text-against-400',icon: X },
  expired:    { label: 'Expired',    color: 'text-surface-500',icon: Clock },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
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

function daysLeft(iso: string): number | null {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

// ─── Thesis Card ─────────────────────────────────────────────────────────────

function ThesisCard({
  thesis,
  index,
  onVote,
}: {
  thesis: Thesis
  index: number
  onVote: (id: string, agree: boolean, prev: boolean | null) => void
}) {
  const [voting, setVoting] = useState(false)
  const [localVote, setLocalVote] = useState<boolean | null>(thesis.viewer_vote ?? null)
  const [localAgree, setLocalAgree] = useState(thesis.agree_count)
  const [localDisagree, setLocalDisagree] = useState(thesis.disagree_count)

  const catColor = CAT_COLORS[thesis.category] ?? 'text-surface-400 border-surface-400/40 bg-surface-300/20'
  const statusCfg = STATUS_CONFIG[thesis.status] ?? STATUS_CONFIG.active
  const total = localAgree + localDisagree
  const agreeWidth = total > 0 ? Math.round((localAgree / total) * 100) : 50
  const days = thesis.resolution_date ? daysLeft(thesis.resolution_date) : null

  async function handleVote(agree: boolean) {
    if (voting) return
    setVoting(true)

    const prev = localVote
    // Optimistic update
    if (prev === agree) {
      // Remove vote
      setLocalVote(null)
      agree ? setLocalAgree((c) => Math.max(0, c - 1)) : setLocalDisagree((c) => Math.max(0, c - 1))
    } else {
      if (prev !== null) {
        prev ? setLocalAgree((c) => Math.max(0, c - 1)) : setLocalDisagree((c) => Math.max(0, c - 1))
      }
      setLocalVote(agree)
      agree ? setLocalAgree((c) => c + 1) : setLocalDisagree((c) => c + 1)
    }

    try {
      await fetch(`/api/thesis/${thesis.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agree: prev === agree ? null : agree }),
      })
      onVote(thesis.id, agree, prev)
    } catch {
      // Revert on error
      setLocalVote(prev)
      setLocalAgree(thesis.agree_count)
      setLocalDisagree(thesis.disagree_count)
    } finally {
      setVoting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4), duration: 0.3 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-all overflow-hidden"
    >
      {/* Card header */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-0">
        <Link
          href={`/profile/${thesis.author?.username ?? ''}`}
          className="flex items-center gap-2 min-w-0 group"
          onClick={(e) => e.stopPropagation()}
        >
          <Avatar
            src={thesis.author?.avatar_url ?? null}
            username={thesis.author?.username ?? '?'}
            size={28}
            className="flex-shrink-0"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate group-hover:text-for-400 transition-colors">
              {thesis.author?.display_name || thesis.author?.username || 'Anonymous'}
            </p>
            <p className="text-[10px] font-mono text-surface-500 truncate">
              {relTime(thesis.created_at)}
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className={cn(
              'text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border capitalize',
              catColor
            )}
          >
            {thesis.category}
          </span>
          <span
            className={cn(
              'text-[10px] font-mono font-semibold',
              statusCfg.color
            )}
          >
            <statusCfg.icon className="h-3 w-3 inline-block mr-0.5 -mt-px" />
            {statusCfg.label}
          </span>
        </div>
      </div>

      {/* Statement */}
      <Link href={`/thesis/${thesis.id}`} className="block px-4 py-3">
        <p className="text-sm font-mono text-white leading-relaxed hover:text-surface-100 transition-colors">
          &ldquo;{thesis.statement}&rdquo;
        </p>
        {thesis.rationale && (
          <p className="text-xs font-mono text-surface-500 mt-1.5 line-clamp-2">
            {thesis.rationale}
          </p>
        )}
      </Link>

      {/* Related topic */}
      {thesis.related_topic_statement && (
        <Link
          href={`/topic/${thesis.related_topic_id}`}
          className="mx-4 mb-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3 text-surface-500 flex-shrink-0" />
          <span className="text-[10px] font-mono text-surface-500 truncate">
            {thesis.related_topic_statement}
          </span>
        </Link>
      )}

      {/* Vote bar */}
      {total > 0 && (
        <div className="px-4 mb-3 space-y-1">
          <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300">
            <div
              className="bg-for-500 transition-all duration-500"
              style={{ width: `${agreeWidth}%` }}
            />
            <div
              className="bg-against-500 transition-all duration-500"
              style={{ width: `${100 - agreeWidth}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
            <span>{localAgree} agree</span>
            <span>{localDisagree} disagree</span>
          </div>
        </div>
      )}

      {/* Resolution date */}
      {days !== null && thesis.status === 'active' && (
        <div className="px-4 mb-3">
          <span
            className={cn(
              'flex items-center gap-1 text-[10px] font-mono',
              days <= 7 ? 'text-against-400' : days <= 30 ? 'text-gold' : 'text-surface-500'
            )}
          >
            <Calendar className="h-3 w-3" />
            {days === 0 ? 'Resolves today' : `Resolves in ${days}d`}
          </span>
        </div>
      )}

      {/* Agree / Disagree buttons */}
      {thesis.status === 'active' && (
        <div className="flex border-t border-surface-300">
          <button
            onClick={() => handleVote(true)}
            disabled={voting}
            aria-label="Agree with this thesis"
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 text-xs font-mono font-semibold',
              'border-r border-surface-300 transition-all focus:outline-none',
              'disabled:opacity-50',
              localVote === true
                ? 'bg-for-500/15 text-for-400'
                : 'text-surface-500 hover:bg-for-500/10 hover:text-for-400'
            )}
          >
            {voting && localVote !== true ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ThumbsUp className={cn('h-3.5 w-3.5', localVote === true && 'fill-current')} />
            )}
            Agree
          </button>
          <button
            onClick={() => handleVote(false)}
            disabled={voting}
            aria-label="Disagree with this thesis"
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 text-xs font-mono font-semibold',
              'transition-all focus:outline-none',
              'disabled:opacity-50',
              localVote === false
                ? 'bg-against-500/15 text-against-400'
                : 'text-surface-500 hover:bg-against-500/10 hover:text-against-400'
            )}
          >
            {voting && localVote !== false ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ThumbsDown className={cn('h-3.5 w-3.5', localVote === false && 'fill-current')} />
            )}
            Disagree
          </button>
        </div>
      )}
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ThesisSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/6" />
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="flex gap-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

const STATUS_TABS: { id: ThesisStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'vindicated', label: 'Vindicated' },
  { id: 'refuted', label: 'Refuted' },
]

export function FollowingThesesClient() {
  const router = useRouter()
  const [theses, setTheses] = useState<Thesis[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [statusTab, setStatusTab] = useState<ThesisStatus | 'all'>('all')
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  const [hasFollowing, setHasFollowing] = useState<boolean | null>(null)
  const isMounted = useRef(true)

  useEffect(() => {
    return () => { isMounted.current = false }
  }, [])

  useEffect(() => {
    // Check auth state
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (isMounted.current) setIsLoggedIn(!!user)
    })
  }, [])

  const fetchTheses = useCallback(async (reset = true) => {
    const currentOffset = reset ? 0 : offset
    if (reset) {
      setLoading(true)
      setOffset(0)
    } else {
      setLoadingMore(true)
    }

    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(currentOffset) })
      if (statusTab !== 'all') params.set('status', statusTab)

      const res = await fetch(`/api/thesis/following?${params}`, { cache: 'no-store' })
      if (!res.ok) return

      const data: FollowingThesisResponse = await res.json()
      if (!isMounted.current) return

      setIsLoggedIn(data.isLoggedIn)
      if (!data.isLoggedIn) return

      const hasAny = data.total > 0 || data.theses.length > 0
      setHasFollowing(hasAny || statusTab !== 'all')

      if (reset) {
        setTheses(data.theses)
      } else {
        setTheses((prev) => [...prev, ...data.theses])
        setOffset(currentOffset + data.theses.length)
      }
      setTotal(data.total)
    } finally {
      if (isMounted.current) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [offset, statusTab])

  useEffect(() => {
    fetchTheses(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusTab])

  function handleVote(id: string, agree: boolean, prev: boolean | null) {
    // No-op — optimistic updates happen inside ThesisCard
  }

  const hasMore = theses.length < total

  if (isLoggedIn === false) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-16 pb-24 flex flex-col items-center justify-center text-center gap-4">
          <Scroll className="h-10 w-10 text-surface-500" />
          <p className="text-white font-mono text-lg font-bold">Sign in to see theses from people you follow</p>
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
          >
            Sign in
          </Link>
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
              <Users className="h-5 w-5 text-purple" />
            </div>
            <div className="min-w-0">
              <h1 className="font-mono text-xl font-bold text-white">Following · Theses</h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Predictions from people you follow
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchTheses(true)}
            disabled={loading}
            aria-label="Refresh"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusTab(tab.id)}
              className={cn(
                'flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                statusTab === tab.id
                  ? 'bg-purple/20 border-purple/50 text-purple'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <ThesisSkeleton key={i} />
              ))}
            </motion.div>
          ) : isLoggedIn && hasFollowing === false ? (
            <motion.div
              key="no-following"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <EmptyState
                icon={UserPlus}
                title="Follow people to see their theses"
                description="When you follow other citizens, their civic predictions will appear here. Find voices you trust in the Lobby."
                action={{
                  label: 'Discover people',
                  href: '/discover',
                }}
              />
            </motion.div>
          ) : theses.length === 0 ? (
            <motion.div
              key="no-theses"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <EmptyState
                icon={Scroll}
                title="No theses yet"
                description={
                  statusTab === 'all'
                    ? 'The people you follow haven\'t published any theses yet.'
                    : `No ${statusTab} theses from the people you follow.`
                }
                action={{
                  label: 'Browse all theses',
                  href: '/thesis',
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {/* Count */}
              <p className="text-xs font-mono text-surface-500">
                {total} {total === 1 ? 'thesis' : 'theses'} from people you follow
              </p>

              {theses.map((thesis, i) => (
                <ThesisCard
                  key={thesis.id}
                  thesis={thesis}
                  index={i}
                  onVote={handleVote}
                />
              ))}

              {/* Load more */}
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => fetchTheses(false)}
                    disabled={loadingMore}
                    className={cn(
                      'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-mono font-semibold',
                      'bg-surface-200 border border-surface-300 text-surface-500',
                      'hover:bg-surface-300 hover:text-white hover:border-surface-400',
                      'transition-all disabled:opacity-50'
                    )}
                  >
                    {loadingMore ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
