'use client'

/**
 * /coalitions/clashes — Global Coalition Clash Arena
 *
 * A public spectator view of all coalition challenges happening across the
 * platform. Citizens who aren't in a coalition can follow the drama; coalition
 * leaders can scout opponents; members can track their coalition's record.
 *
 * Tabs:
 *   Active   — accepted challenges currently in progress
 *   Pending  — open challenges awaiting a response
 *   Resolved — completed/won challenges
 *
 * Each card shows:
 *   • Challenger vs Challenged coalition with member counts
 *   • Both stances (FOR / AGAINST / NEUTRAL)
 *   • Topic statement and status
 *   • Clout stake (if any)
 *   • Time context (expires at, resolved at, started at)
 *   • Winner badge for resolved challenges
 *
 * Distinct from:
 *   /coalitions/[id]/challenges  — per-coalition challenge board (for members)
 *   /coalitions/standings        — coalition win/loss leaderboard
 *   /arena                       — argument-level faceoff arena
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Coins,
  Crown,
  ExternalLink,
  Loader2,
  RefreshCw,
  Shield,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  Timer,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { GlobalChallenge, ClashesResponse } from '@/app/api/coalition-challenges/route'

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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'expired'
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d left`
  if (h > 0) return `${h}h left`
  const m = Math.floor(diff / 60_000)
  return `${m}m left`
}

function fmtMembers(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}

type StatusFilter = 'active' | 'pending' | 'resolved'

const STANCE_CONFIG = {
  for: {
    label: 'FOR',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    icon: ThumbsUp,
  },
  against: {
    label: 'AGAINST',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    icon: ThumbsDown,
  },
  neutral: {
    label: 'NEUTRAL',
    color: 'text-surface-400',
    bg: 'bg-surface-300/10',
    border: 'border-surface-300/20',
    icon: Shield,
  },
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

// ─── Stance pill ──────────────────────────────────────────────────────────────

function StancePill({ stance }: { stance: 'for' | 'against' | 'neutral' | null }) {
  if (!stance) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-surface-300/20 border border-surface-300/30 text-surface-500">
        <Clock className="h-2.5 w-2.5" />
        TBD
      </span>
    )
  }
  const cfg = STANCE_CONFIG[stance]
  const Icon = cfg.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold border',
        cfg.color, cfg.bg, cfg.border
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  )
}

// ─── Skeleton cards ───────────────────────────────────────────────────────────

function ClashSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="h-5 w-20 rounded" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="h-5 w-20 rounded" />
            </div>
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ))}
    </div>
  )
}

// ─── Challenge card ───────────────────────────────────────────────────────────

function ClashCard({ challenge }: { challenge: GlobalChallenge }) {
  const isWinnerChallenger = challenge.winnerId === challenge.challengerId
  const isWinnerChallenged = challenge.winnerId === challenge.challengedId

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-5 space-y-4 transition-colors',
        challenge.status === 'accepted'
          ? 'bg-surface-100 border-for-500/20 hover:border-for-500/40'
          : challenge.status === 'resolved' && challenge.winnerId
          ? 'bg-surface-100 border-gold/20 hover:border-gold/40'
          : 'bg-surface-100 border-surface-300 hover:border-surface-400'
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {challenge.topicCategory && (
            <span className={cn('text-[11px] font-mono font-semibold', CATEGORY_COLOR[challenge.topicCategory] ?? 'text-surface-400')}>
              {challenge.topicCategory}
            </span>
          )}
          {challenge.stakeClout > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-mono text-gold">
              <Coins className="h-3 w-3" />
              {challenge.stakeClout.toLocaleString()} at stake
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {challenge.status === 'accepted' && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-for-500/15 border border-for-500/30 text-for-400">
              <Zap className="h-2.5 w-2.5" />
              LIVE
            </span>
          )}
          {challenge.status === 'pending' && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-gold/10 border border-gold/30 text-gold">
              <Timer className="h-2.5 w-2.5" />
              {timeUntil(challenge.expiresAt)}
            </span>
          )}
          {challenge.status === 'resolved' && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald/10 border border-emerald/30 text-emerald">
              <CheckCircle2 className="h-2.5 w-2.5" />
              RESOLVED
            </span>
          )}
        </div>
      </div>

      {/* Coalition matchup */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {/* Challenger */}
        <Link
          href={`/coalitions/${challenge.challengerId}`}
          className="group space-y-1 min-w-0"
        >
          <p className={cn(
            'font-mono font-bold text-sm truncate transition-colors group-hover:text-for-300',
            isWinnerChallenger ? 'text-gold' : 'text-white'
          )}>
            {isWinnerChallenger && <Crown className="inline h-3.5 w-3.5 text-gold mr-1 mb-0.5" />}
            {challenge.challengerName}
          </p>
          <p className="flex items-center gap-1 text-[11px] text-surface-500">
            <Users className="h-2.5 w-2.5" />
            {fmtMembers(challenge.challengerMemberCount)} members
          </p>
          <StancePill stance={challenge.challengerStance} />
        </Link>

        {/* VS badge */}
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-surface-200 border border-surface-300 flex-shrink-0">
          <Swords className="h-4 w-4 text-against-400" aria-label="versus" />
        </div>

        {/* Challenged */}
        <Link
          href={`/coalitions/${challenge.challengedId}`}
          className="group space-y-1 min-w-0 text-right"
        >
          <p className={cn(
            'font-mono font-bold text-sm truncate transition-colors group-hover:text-for-300',
            isWinnerChallenged ? 'text-gold' : 'text-white'
          )}>
            {isWinnerChallenged && <Crown className="inline h-3.5 w-3.5 text-gold mr-1 mb-0.5" />}
            {challenge.challengedName}
          </p>
          <p className="flex items-center justify-end gap-1 text-[11px] text-surface-500">
            {fmtMembers(challenge.challengedMemberCount)} members
            <Users className="h-2.5 w-2.5" />
          </p>
          <div className="flex justify-end">
            <StancePill stance={challenge.challengedStance} />
          </div>
        </Link>
      </div>

      {/* Topic */}
      <Link
        href={`/topic/${challenge.topicId}`}
        className="group flex items-start gap-3 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 px-4 py-3 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs text-surface-500 font-mono mb-1">TOPIC</p>
          <p className="text-sm text-surface-700 group-hover:text-white transition-colors leading-snug line-clamp-2">
            {challenge.topicStatement}
          </p>
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-surface-500 group-hover:text-for-400 transition-colors shrink-0 mt-0.5" />
      </Link>

      {/* Challenger message */}
      {challenge.message && (
        <div className="rounded-xl bg-surface-200/40 border border-surface-300/40 px-4 py-2.5">
          <p className="text-[11px] font-mono text-surface-500 mb-1">CHALLENGE MESSAGE</p>
          <p className="text-xs text-surface-600 italic leading-snug">&ldquo;{challenge.message}&rdquo;</p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-0.5">
        <p className="text-[11px] text-surface-600 font-mono">
          Issued by{' '}
          <Link href={`/profile/${challenge.issuedByUsername}`} className="text-surface-500 hover:text-white transition-colors">
            @{challenge.issuedByUsername}
          </Link>
          {' · '}{relativeTime(challenge.createdAt)}
        </p>
        {challenge.status === 'resolved' && challenge.winnerName && (
          <span className="flex items-center gap-1 text-[11px] font-mono font-semibold text-gold">
            <Trophy className="h-3 w-3" />
            {challenge.winnerName} won
          </span>
        )}
        {challenge.status === 'resolved' && !challenge.winnerName && (
          <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <XCircle className="h-3 w-3" />
            No winner declared
          </span>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TABS: { id: StatusFilter; label: string; icon: typeof Swords }[] = [
  { id: 'active',   label: 'Active',   icon: Zap },
  { id: 'pending',  label: 'Pending',  icon: Clock },
  { id: 'resolved', label: 'Resolved', icon: Trophy },
]

export default function CoalitionClashesPage() {
  const [tab, setTab] = useState<StatusFilter>('active')
  const [challenges, setChallenges] = useState<GlobalChallenge[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const offsetRef = useRef(0)

  const LIMIT = 20

  const load = useCallback(async (status: StatusFilter, reset: boolean) => {
    if (reset) {
      setLoading(true)
      offsetRef.current = 0
    } else {
      setLoadingMore(true)
    }
    setError(null)

    try {
      const params = new URLSearchParams({
        status,
        limit: LIMIT.toString(),
        offset: offsetRef.current.toString(),
      })
      const res = await fetch(`/api/coalition-challenges?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data: ClashesResponse = await res.json()

      if (reset) {
        setChallenges(data.challenges)
      } else {
        setChallenges((prev) => [...prev, ...data.challenges])
      }
      setTotal(data.total)
      setHasMore(data.hasMore)
      offsetRef.current += data.challenges.length
    } catch {
      setError('Failed to load clashes. Try again.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    load(tab, true)
  }, [tab, load])

  function handleTabChange(newTab: StatusFilter) {
    if (newTab === tab) return
    setTab(newTab)
  }

  const isEmpty = !loading && challenges.length === 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12 space-y-6">

        {/* Page header */}
        <div className="flex items-start gap-3">
          <Link
            href="/coalitions"
            aria-label="Back to coalitions"
            className="flex-shrink-0 mt-0.5 flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-surface-500" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-against-500/10 border border-against-500/30">
                <Swords className="h-5 w-5 text-against-400" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">Coalition Clashes</h1>
                <p className="text-xs font-mono text-surface-500">
                  {total > 0 ? `${total.toLocaleString()} challenge${total !== 1 ? 's' : ''}` : 'Inter-coalition debate challenges'}
                </p>
              </div>
            </div>
            <p className="mt-2 text-sm text-surface-500 leading-snug">
              Watch coalitions battle over the Lobby&apos;s most contested topics.
              When a challenge is accepted both sides declare their stance and members earn bonus influence for arguing on that topic.
            </p>
          </div>
        </div>

        {/* Links row */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/coalitions/standings"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <Trophy className="h-3.5 w-3.5" />
            Standings
          </Link>
          <Link
            href="/leaderboard/coalitions"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <Crown className="h-3.5 w-3.5" />
            Leaderboard
          </Link>
          <Link
            href="/coalitions"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <Shield className="h-3.5 w-3.5" />
            All Coalitions
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-surface-200 border border-surface-300">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-semibold transition-all',
                tab === id
                  ? 'bg-surface-100 text-white shadow-sm border border-surface-300'
                  : 'text-surface-500 hover:text-surface-700'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <ClashSkeleton />
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-against-500/30 p-6 text-center space-y-3">
            <XCircle className="h-8 w-8 text-against-400 mx-auto" />
            <p className="text-sm text-surface-500">{error}</p>
            <button
              onClick={() => load(tab, true)}
              className="flex items-center gap-1.5 mx-auto px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-sm font-mono text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : isEmpty ? (
          <EmptyState
            icon={Swords}
            title={
              tab === 'active' ? 'No active clashes' :
              tab === 'pending' ? 'No pending challenges' :
              'No resolved clashes yet'
            }
            description={
              tab === 'active'
                ? 'No coalitions are clashing right now. Check pending challenges or resolved history.'
                : tab === 'pending'
                ? 'No challenges are waiting for a response. Coalition leaders can issue challenges from their coalition page.'
                : 'No clashes have been resolved yet. Check active or pending challenges.'
            }
            action={
              tab !== 'active'
                ? { label: 'View active clashes', onClick: () => setTab('active') }
                : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {challenges.map((c) => (
                <ClashCard key={c.id} challenge={c} />
              ))}
            </AnimatePresence>

            {hasMore && (
              <button
                onClick={() => load(tab, false)}
                disabled={loadingMore}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 text-sm font-mono text-surface-500 hover:text-white transition-all disabled:opacity-50"
              >
                {loadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Load more
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
