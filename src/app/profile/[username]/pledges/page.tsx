'use client'

/**
 * /profile/[username]/pledges — Civic Pledge Wall for a user
 *
 * Shows all public civic pledges made by this citizen: their title,
 * category, status (active / completed / abandoned), progress toward
 * any numeric target, witness count, and deadline if set.
 *
 * Viewers can witness active pledges from this page.
 *
 * Distinct from:
 *   /pledges         — platform-wide pledge wall (all users)
 *   /api/pledges     — global pledge feed API
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Flag,
  Loader2,
  RefreshCw,
  Shield,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PledgeProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

interface Pledge {
  id: string
  title: string
  description: string | null
  category: string
  status: 'active' | 'completed' | 'abandoned'
  target_count: number | null
  current_count: number
  witness_count: number
  deadline: string | null
  completed_at: string | null
  created_at: string
  viewer_is_witness: boolean
}

interface PledgesPageData {
  profile: PledgeProfile
  pledges: Pledge[]
  is_own_profile: boolean
  stats: {
    total: number
    active: number
    completed: number
    abandoned: number
    total_witnesses: number
  }
}

// ─── Category config ───────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  participation:  { label: 'Participation',  color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  advocacy:       { label: 'Advocacy',       color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  debate:         { label: 'Debate',         color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  research:       { label: 'Research',       color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  community:      { label: 'Community',      color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  accountability: { label: 'Accountability', color: 'text-surface-300', bg: 'bg-surface-200/50', border: 'border-surface-400/30' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: typeof CheckCircle2 }> = {
  active:    { label: 'Active',    color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     icon: Zap },
  completed: { label: 'Completed', color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     icon: CheckCircle2 },
  abandoned: { label: 'Abandoned', color: 'text-surface-500', bg: 'bg-surface-200/40', border: 'border-surface-400/30', icon: XCircle },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function deadlineLabel(deadline: string | null): { label: string; urgent: boolean } | null {
  if (!deadline) return null
  const diff = new Date(deadline).getTime() - Date.now()
  const d = Math.ceil(diff / 86_400_000)
  if (d < 0) return { label: 'Expired', urgent: true }
  if (d === 0) return { label: 'Due today', urgent: true }
  if (d === 1) return { label: 'Due tomorrow', urgent: true }
  if (d <= 7) return { label: `${d}d left`, urgent: true }
  return { label: `${d}d left`, urgent: false }
}

// ─── Pledge card ───────────────────────────────────────────────────────────────

function PledgeCard({
  pledge,
  isOwner,
  onWitness,
  witnessing,
}: {
  pledge: Pledge
  isOwner: boolean
  onWitness: (id: string) => void
  witnessing: string | null
}) {
  const cat = CATEGORY_CONFIG[pledge.category] ?? CATEGORY_CONFIG.participation
  const st = STATUS_CONFIG[pledge.status] ?? STATUS_CONFIG.active
  const StatusIcon = st.icon
  const dl = deadlineLabel(pledge.deadline)
  const hasProgress = pledge.target_count !== null && pledge.target_count > 0
  const progressPct = hasProgress
    ? Math.min(100, Math.round((pledge.current_count / pledge.target_count!) * 100))
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-xl border p-4 bg-surface-100 transition-colors',
        pledge.status === 'active'
          ? 'border-for-500/20 hover:border-for-500/40'
          : pledge.status === 'completed'
          ? 'border-emerald/20 hover:border-emerald/30'
          : 'border-surface-300 hover:border-surface-400 opacity-60',
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div className={cn(
          'flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl border',
          st.bg, st.border,
        )}>
          <StatusIcon className={cn('h-4 w-4', st.color)} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Badge row */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <span className={cn(
              'text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border font-semibold',
              st.color, st.bg, st.border,
            )}>
              {st.label}
            </span>
            <span className={cn(
              'text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border',
              cat.color, cat.bg, cat.border,
            )}>
              {cat.label}
            </span>
            {dl && (
              <span className={cn(
                'text-[9px] font-mono flex items-center gap-0.5',
                dl.urgent ? 'text-against-400' : 'text-surface-500',
              )}>
                <Clock className="h-2.5 w-2.5" />
                {dl.label}
              </span>
            )}
          </div>

          {/* Title */}
          <p className="text-sm font-mono font-semibold text-white leading-snug mb-1">
            {pledge.title}
          </p>

          {/* Description */}
          {pledge.description && (
            <p className="text-xs font-mono text-surface-400 leading-relaxed mb-2 line-clamp-2">
              {pledge.description}
            </p>
          )}

          {/* Progress bar */}
          {hasProgress && pledge.status === 'active' && (
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono text-surface-500">
                  {pledge.current_count} / {pledge.target_count}
                </span>
                <span className="text-[10px] font-mono text-for-400">
                  {progressPct}%
                </span>
              </div>
              <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
                <div
                  className="h-full bg-for-500 rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-mono text-surface-600 flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {relativeTime(pledge.created_at)}
            </span>
            {pledge.completed_at && (
              <span className="text-[10px] font-mono text-emerald flex items-center gap-1">
                <Check className="h-2.5 w-2.5" />
                Done {relativeTime(pledge.completed_at)}
              </span>
            )}
            {pledge.witness_count > 0 && (
              <span className="text-[10px] font-mono text-surface-500 flex items-center gap-1">
                <Users className="h-2.5 w-2.5" />
                {pledge.witness_count} witness{pledge.witness_count !== 1 ? 'es' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Witness button (for other users, active pledges) */}
        {!isOwner && pledge.status === 'active' && (
          <button
            onClick={() => onWitness(pledge.id)}
            disabled={pledge.viewer_is_witness || witnessing === pledge.id}
            aria-label={pledge.viewer_is_witness ? 'You witnessed this pledge' : 'Witness this pledge'}
            className={cn(
              'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg border transition-colors',
              pledge.viewer_is_witness
                ? 'bg-emerald/10 border-emerald/30 text-emerald cursor-default'
                : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
              witnessing === pledge.id && 'animate-pulse',
            )}
          >
            {witnessing === pledge.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : pledge.viewer_is_witness ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Shield className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PledgeSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex gap-1.5">
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-4 w-20 rounded" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePledgesPage() {
  const params = useParams<{ username: string }>()
  const username = params.username

  const [data, setData] = useState<PledgesPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [witnessing, setWitnessing] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch(`/api/profile/${encodeURIComponent(username)}/pledges`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError((j as { error?: string }).error ?? 'Failed to load pledges')
        return
      }
      setData(await res.json() as PledgesPageData)
      setError(null)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [username])

  useEffect(() => { load() }, [load])

  async function handleWitness(pledgeId: string) {
    if (!data) return
    setWitnessing(pledgeId)
    try {
      const res = await fetch(`/api/pledges/${pledgeId}/witness`, { method: 'POST' })
      if (res.ok) {
        setData((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            pledges: prev.pledges.map((p) =>
              p.id === pledgeId
                ? { ...p, viewer_is_witness: true, witness_count: p.witness_count + 1 }
                : p
            ),
          }
        })
      }
    } catch {
      // best-effort
    } finally {
      setWitnessing(null)
    }
  }

  const filtered = data?.pledges.filter((p) => {
    if (filterStatus === 'active') return p.status === 'active'
    if (filterStatus === 'completed') return p.status === 'completed'
    return true
  }) ?? []

  const profile = data?.profile
  const stats = data?.stats
  const isOwner = data?.is_own_profile ?? false

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Back link */}
        <Link
          href={profile ? `/profile/${profile.username}` : '/'}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {profile ? `@${profile.username}` : 'Back'}
        </Link>

        {/* Profile header skeleton */}
        {loading && (
          <>
            <div className="flex items-center gap-4 mb-6">
              <Skeleton className="h-14 w-14 rounded-2xl flex-shrink-0" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-3">
                  <Skeleton className="h-2.5 w-12 mb-2" />
                  <Skeleton className="h-6 w-8" />
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <PledgeSkeleton key={i} />
              ))}
            </div>
          </>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-8 text-center">
            <p className="text-sm font-mono text-surface-500 mb-4">{error}</p>
            <button
              onClick={() => load(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}

        {/* Content */}
        {!loading && !error && data && profile && stats && (
          <>
            {/* Profile header */}
            <div className="flex items-center gap-4 mb-6">
              <Avatar
                src={profile.avatar_url}
                fallback={profile.display_name ?? profile.username}
                size="lg"
                className="rounded-2xl"
              />
              <div>
                <h1 className="font-mono text-xl font-bold text-white">
                  {profile.display_name ?? `@${profile.username}`}
                </h1>
                <p className="text-sm font-mono text-surface-500">
                  {isOwner ? 'Your' : `@${profile.username}'s`} civic pledges
                </p>
              </div>

              <button
                onClick={() => load(true)}
                disabled={refreshing}
                aria-label="Refresh"
                className="ml-auto flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white transition-colors"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Total', value: stats.total,           color: 'text-white' },
                { label: 'Active', value: stats.active,          color: 'text-for-400' },
                { label: 'Done', value: stats.completed,         color: 'text-emerald' },
                { label: 'Witnesses', value: stats.total_witnesses, color: 'text-gold' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-2xl bg-surface-100 border border-surface-300 p-3 text-center">
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                    {label}
                  </p>
                  <p className={cn('text-xl font-mono font-black', color)}>
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {/* Nav breadcrumb */}
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              {[
                { href: `/profile/${profile.username}`,           label: 'Profile' },
                { href: `/profile/${profile.username}/votes`,     label: 'Votes' },
                { href: `/profile/${profile.username}/arguments`, label: 'Arguments' },
                { href: `/profile/${profile.username}/bounties`,  label: 'Bounties' },
                { href: `/profile/${profile.username}/pledges`,   label: 'Pledges', active: true },
              ].map(({ href, label, active }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors',
                    active
                      ? 'bg-emerald/10 border-emerald/30 text-emerald'
                      : 'bg-surface-100 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>

            {/* Filter pills */}
            {stats.total > 0 && (
              <div className="flex items-center gap-2 mb-5">
                {(['all', 'active', 'completed'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilterStatus(f)}
                    className={cn(
                      'text-xs font-mono px-3 py-1 rounded-full border transition-colors capitalize',
                      filterStatus === f
                        ? 'bg-for-600 border-for-500/40 text-white'
                        : 'bg-surface-100 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
                    )}
                  >
                    {f === 'all' ? `All ${stats.total}` : f === 'active' ? `Active ${stats.active}` : `Completed ${stats.completed}`}
                  </button>
                ))}

                {!isOwner && (
                  <Link
                    href="/pledges"
                    className="ml-auto text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Pledge Wall
                  </Link>
                )}
                {isOwner && (
                  <Link
                    href="/pledges"
                    className="ml-auto inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-full border bg-for-600 border-for-500/40 text-white hover:bg-for-500 transition-colors"
                  >
                    <Flag className="h-3 w-3" />
                    New Pledge
                  </Link>
                )}
              </div>
            )}

            {/* Pledge list */}
            <AnimatePresence mode="wait">
              {filtered.length === 0 ? (
                <EmptyState
                  key="empty"
                  icon={Flag}
                  iconColor="text-emerald"
                  iconBg="bg-emerald/10"
                  iconBorder="border-emerald/30"
                  title={
                    stats.total === 0
                      ? isOwner
                        ? 'No pledges yet'
                        : `${profile.display_name ?? `@${profile.username}`} hasn't made any pledges`
                      : `No ${filterStatus} pledges`
                  }
                  description={
                    stats.total === 0
                      ? isOwner
                        ? 'Make a public civic commitment — let the community hold you accountable.'
                        : 'Public civic pledges show up here when this citizen makes a commitment.'
                      : undefined
                  }
                  actions={
                    isOwner && stats.total === 0
                      ? [{ label: 'Make a Pledge', href: '/pledges' }]
                      : undefined
                  }
                />
              ) : (
                <motion.div
                  key="list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  {filtered.map((pledge) => (
                    <PledgeCard
                      key={pledge.id}
                      pledge={pledge}
                      isOwner={isOwner}
                      onWitness={handleWitness}
                      witnessing={witnessing}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Category breakdown */}
            {stats.total > 0 && (() => {
              const catCounts: Record<string, number> = {}
              data.pledges.forEach((p) => {
                catCounts[p.category] = (catCounts[p.category] ?? 0) + 1
              })
              const entries = Object.entries(catCounts).sort((a, b) => b[1] - a[1])
              if (entries.length < 2) return null
              return (
                <div className="mt-8 rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <h3 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-4">
                    Pledge categories
                  </h3>
                  <div className="space-y-2">
                    {entries.map(([cat, count]) => {
                      const cfg = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.participation
                      const pct = Math.round((count / stats.total) * 100)
                      return (
                        <div key={cat} className="flex items-center gap-3">
                          <span className={cn('text-[10px] font-mono w-28 flex-shrink-0 uppercase tracking-wide', cfg.color)}>
                            {cfg.label}
                          </span>
                          <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                            <div
                              className={cn('h-full rounded-full', cfg.bg.replace('/10', '/60'))}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-surface-500 w-6 text-right">
                            {count}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* CTA for own profile */}
            {isOwner && stats.active > 0 && (
              <div className="mt-6 rounded-2xl border border-emerald/20 bg-emerald/5 p-4 flex items-center gap-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-emerald" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-semibold text-white">
                    {stats.active} active pledge{stats.active !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs font-mono text-surface-500">
                    Your community is watching. Keep going.
                  </p>
                </div>
                <Link
                  href="/pledges"
                  className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white transition-colors"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}

            {/* Calendar / deadline summary */}
            {(() => {
              const withDeadlines = data.pledges.filter(
                (p) => p.status === 'active' && p.deadline != null,
              )
              if (withDeadlines.length === 0) return null
              return (
                <div className="mt-4 rounded-xl border border-surface-300 bg-surface-100 p-4">
                  <h3 className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    Upcoming deadlines
                  </h3>
                  <div className="space-y-2">
                    {withDeadlines
                      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
                      .map((p) => {
                        const dl = deadlineLabel(p.deadline)
                        return (
                          <div key={p.id} className="flex items-center gap-3">
                            <span className={cn(
                              'text-[10px] font-mono w-20 flex-shrink-0',
                              dl?.urgent ? 'text-against-400' : 'text-surface-500',
                            )}>
                              {dl?.label}
                            </span>
                            <p className="text-[10px] font-mono text-surface-400 truncate flex-1">
                              {p.title}
                            </p>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )
            })()}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
