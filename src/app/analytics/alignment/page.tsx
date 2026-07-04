'use client'

/**
 * /analytics/alignment — Civic Alignment Report
 *
 * Shows how your votes align with your specific network — the people you
 * follow and the members of your coalitions.
 *
 * Distinct from:
 *   /analytics/kin      — finds your best/worst matches platform-wide
 *   /compare-users      — manual one-on-one comparison
 *   /twins              — discover users who vote like you
 *   /analytics/following — your followed network's activity feed
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  GitCompare,
  Heart,
  Info,
  RefreshCw,
  Scale,
  Shield,
  Swords,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { AlignedUser, AlignmentNetworkResponse } from '@/app/api/analytics/alignment-network/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
  senator: 'Senator',
  lawmaker: 'Lawmaker',
}

function alignmentLabel(pct: number): { label: string; color: string; bg: string; border: string } {
  if (pct >= 85) return { label: 'Very High', color: 'text-emerald',     bg: 'bg-emerald/10',      border: 'border-emerald/30' }
  if (pct >= 70) return { label: 'High',      color: 'text-for-300',     bg: 'bg-for-500/10',      border: 'border-for-500/30' }
  if (pct >= 55) return { label: 'Moderate',  color: 'text-for-400',     bg: 'bg-for-500/8',       border: 'border-for-500/20' }
  if (pct >= 45) return { label: 'Mixed',     color: 'text-gold',        bg: 'bg-gold/10',          border: 'border-gold/30' }
  if (pct >= 30) return { label: 'Low',       color: 'text-against-400', bg: 'bg-against-500/10',  border: 'border-against-500/30' }
  return               { label: 'Very Low',  color: 'text-against-300', bg: 'bg-against-600/10',  border: 'border-against-600/30' }
}

function alignmentBarColor(pct: number): string {
  if (pct >= 70) return 'bg-emerald'
  if (pct >= 55) return 'bg-for-500'
  if (pct >= 45) return 'bg-gold'
  return 'bg-against-500'
}

function avgLabel(pct: number | null): string {
  if (pct === null) return '—'
  return `${pct}%`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function UserRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-surface-300/50 last:border-0">
      <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <Skeleton className="h-3.5 w-28 mb-1.5" />
        <Skeleton className="h-2.5 w-20" />
      </div>
      <Skeleton className="h-6 w-12 rounded-lg" />
    </div>
  )
}

function StatSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
      <Skeleton className="h-3 w-20 mb-3" />
      <Skeleton className="h-8 w-14 mb-1" />
      <Skeleton className="h-2.5 w-16" />
    </div>
  )
}

// ─── User Row ─────────────────────────────────────────────────────────────────

function AlignedUserRow({ user }: { user: AlignedUser }) {
  const { color, bg, border } = alignmentLabel(user.agreement_pct)
  const barColor = alignmentBarColor(user.agreement_pct)
  const roleLabel = ROLE_LABELS[user.role] ?? 'Citizen'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="group flex items-center gap-3 px-4 py-3.5 border-b border-surface-300/40 last:border-0 hover:bg-surface-200/40 transition-colors"
    >
      {/* Avatar */}
      <Link href={`/profile/${user.username}`} className="flex-shrink-0">
        <Avatar src={user.avatar_url ?? null} fallback={user.username} size="sm" />
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <Link href={`/profile/${user.username}`} className="flex items-center gap-1.5 hover:text-white transition-colors">
          <span className="font-mono font-semibold text-sm text-white truncate">
            {user.display_name || user.username}
          </span>
          <span className="text-surface-500 text-xs font-mono truncate">@{user.username}</span>
        </Link>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-surface-500 font-mono">{roleLabel}</span>
          <span className="text-surface-600 text-xs">·</span>
          <span className="text-xs text-surface-500 font-mono">{user.common_topics} shared topics</span>
        </div>
        {/* Alignment bar */}
        <div className="mt-1.5 h-1 rounded-full bg-surface-300/60 overflow-hidden w-full max-w-[120px]">
          <div
            className={cn('h-full rounded-full transition-all', barColor)}
            style={{ width: `${user.agreement_pct}%` }}
          />
        </div>
      </div>

      {/* Alignment badge */}
      <div className={cn('flex-shrink-0 px-2.5 py-1 rounded-lg border text-xs font-mono font-bold', color, bg, border)}>
        {user.agreement_pct}%
      </div>

      {/* Compare link */}
      <Link
        href={`/compare-users?b=${user.username}`}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Compare votes side-by-side"
        aria-label={`Compare votes with ${user.username}`}
      >
        <GitCompare className="h-4 w-4 text-surface-500 hover:text-white transition-colors" />
      </Link>
    </motion.div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color,
  icon: Icon,
}: {
  label: string
  value: string | number
  sub: string
  color: string
  icon: typeof Scale
}) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-4 w-4', color)} />
        <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className={cn('text-3xl font-mono font-bold mb-0.5', color)}>
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </div>
      <div className="text-xs font-mono text-surface-500">{sub}</div>
    </div>
  )
}

// ─── User List Section ────────────────────────────────────────────────────────

function UserSection({
  title,
  icon: Icon,
  iconColor,
  users,
  emptyMessage,
  loading,
}: {
  title: string
  icon: typeof Users
  iconColor: string
  users: AlignedUser[]
  emptyMessage: string
  loading: boolean
}) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? users : users.slice(0, 8)

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-surface-300 bg-surface-200/50">
        <Icon className={cn('h-4 w-4', iconColor)} />
        <h2 className="font-mono font-semibold text-sm text-white">{title}</h2>
        {!loading && users.length > 0 && (
          <span className="ml-auto text-xs font-mono text-surface-500">
            {users.length} scored
          </span>
        )}
      </div>

      {/* Rows */}
      {loading ? (
        <div>
          {Array.from({ length: 5 }).map((_, i) => <UserRowSkeleton key={i} />)}
        </div>
      ) : users.length === 0 ? (
        <div className="py-10 px-4">
          <EmptyState
            icon={Icon}
            title="No data yet"
            description={emptyMessage}
          />
        </div>
      ) : (
        <div>
          {visible.map((u) => (
            <AlignedUserRow key={u.id} user={u} />
          ))}
          {users.length > 8 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full py-3 text-xs font-mono text-surface-500 hover:text-white transition-colors border-t border-surface-300/40"
            >
              Show {users.length - 8} more
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AlignmentNetworkPage() {
  const router = useRouter()
  const [data, setData] = useState<AlignmentNetworkResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/alignment-network', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load alignment data')
      const json = await res.json() as AlignmentNetworkResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const stats = data?.stats

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
            <Scale className="h-5 w-5 text-for-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-2xl font-bold text-white leading-tight">
              Civic Alignment
            </h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              How your votes align with your network
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-40"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Info callout */}
        <div className="flex items-start gap-3 rounded-xl bg-surface-200/60 border border-surface-300/60 px-4 py-3 mb-6">
          <Info className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs font-mono text-surface-500 leading-relaxed">
            Alignment measures how often you and another citizen voted the same way on shared topics.
            Higher scores mean you tend to see issues the same way. Requires at least 3 overlapping
            votes to compute a meaningful score.
          </p>
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-xl bg-against-500/10 border border-against-500/30 px-4 py-3 mb-6 text-sm font-mono text-against-400">
            {error}
          </div>
        )}

        {/* Not voted yet */}
        {!loading && data && !data.viewer_has_votes && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-10 text-center mb-6">
            <Scale className="h-10 w-10 text-surface-500 mx-auto mb-3" />
            <h2 className="font-mono font-bold text-white mb-1">No votes yet</h2>
            <p className="text-sm font-mono text-surface-500 mb-4">
              Cast votes on topics to start computing alignment with your network.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono font-semibold hover:bg-for-500 transition-colors"
            >
              Browse topics <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* Stats row */}
        {(loading || (data && data.viewer_has_votes)) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
            ) : stats ? (
              <>
                <StatCard
                  label="Avg. Following"
                  value={avgLabel(stats.avg_following_pct)}
                  sub={`${stats.scored_following} of ${stats.total_following} scored`}
                  color="text-for-400"
                  icon={Heart}
                />
                <StatCard
                  label="Avg. Coalition"
                  value={avgLabel(stats.avg_coalition_pct)}
                  sub={`${stats.scored_coalition} of ${stats.total_coalition} scored`}
                  color="text-purple"
                  icon={Shield}
                />
                <StatCard
                  label="Following"
                  value={stats.total_following}
                  sub="people you follow"
                  color="text-emerald"
                  icon={Users}
                />
                <StatCard
                  label="Coalition"
                  value={stats.total_coalition}
                  sub="coalition members"
                  color="text-gold"
                  icon={Zap}
                />
              </>
            ) : null}
          </div>
        )}

        {/* Average alignment indicator */}
        {!loading && data && data.viewer_has_votes && (
          <AnimatePresence>
            {(data.stats.avg_following_pct !== null || data.stats.avg_coalition_pct !== null) && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6"
              >
                <h2 className="font-mono font-semibold text-sm text-surface-400 uppercase tracking-wider mb-4">
                  Network Alignment Overview
                </h2>
                <div className="space-y-3">
                  {data.stats.avg_following_pct !== null && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-mono text-surface-400 flex items-center gap-1.5">
                          <Heart className="h-3.5 w-3.5 text-for-400" />
                          Following
                        </span>
                        <span className={cn('text-sm font-mono font-bold', alignmentLabel(data.stats.avg_following_pct).color)}>
                          {data.stats.avg_following_pct}%
                          <span className="ml-1.5 text-xs font-normal text-surface-500">
                            {alignmentLabel(data.stats.avg_following_pct).label}
                          </span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-300/50 overflow-hidden">
                        <motion.div
                          className={cn('h-full rounded-full', alignmentBarColor(data.stats.avg_following_pct))}
                          initial={{ width: 0 }}
                          animate={{ width: `${data.stats.avg_following_pct}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  )}
                  {data.stats.avg_coalition_pct !== null && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-mono text-surface-400 flex items-center gap-1.5">
                          <Shield className="h-3.5 w-3.5 text-purple" />
                          Coalition
                        </span>
                        <span className={cn('text-sm font-mono font-bold', alignmentLabel(data.stats.avg_coalition_pct).color)}>
                          {data.stats.avg_coalition_pct}%
                          <span className="ml-1.5 text-xs font-normal text-surface-500">
                            {alignmentLabel(data.stats.avg_coalition_pct).label}
                          </span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-300/50 overflow-hidden">
                        <motion.div
                          className={cn('h-full rounded-full bg-purple')}
                          initial={{ width: 0 }}
                          animate={{ width: `${data.stats.avg_coalition_pct}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Following list */}
        <div className="mb-4">
          <UserSection
            title="Following Alignment"
            icon={Heart}
            iconColor="text-for-400"
            users={data?.following ?? []}
            loading={loading}
            emptyMessage="Follow other citizens to see how your votes compare. Look for allies and rivals in your network."
          />
        </div>

        {/* Coalition list */}
        <div className="mb-6">
          <UserSection
            title="Coalition Alignment"
            icon={Shield}
            iconColor="text-purple"
            users={data?.coalition ?? []}
            loading={loading}
            emptyMessage="Join a coalition to see how you align with your fellow members on shared topics."
          />
        </div>

        {/* Related links */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
          <h3 className="font-mono text-sm font-semibold text-surface-400 uppercase tracking-wider mb-4">
            Explore More
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              href="/analytics/kin"
              className="flex items-center gap-2.5 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 px-4 py-3 transition-colors group"
            >
              <Users className="h-4 w-4 text-emerald flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-mono font-semibold text-white">Civic Kin</div>
                <div className="text-[10px] font-mono text-surface-500">Platform-wide matches</div>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-surface-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
            <Link
              href="/twins"
              className="flex items-center gap-2.5 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 px-4 py-3 transition-colors group"
            >
              <Swords className="h-4 w-4 text-for-400 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-mono font-semibold text-white">Civic Twins</div>
                <div className="text-[10px] font-mono text-surface-500">Find your vote double</div>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-surface-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
            <Link
              href="/compare-users"
              className="flex items-center gap-2.5 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 px-4 py-3 transition-colors group"
            >
              <GitCompare className="h-4 w-4 text-gold flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-mono font-semibold text-white">Compare Users</div>
                <div className="text-[10px] font-mono text-surface-500">Side-by-side breakdown</div>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-surface-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
