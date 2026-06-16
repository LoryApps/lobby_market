'use client'

/**
 * /coalitions/[id]/debates — Coalition Debate History
 *
 * Shows all debates where coalition members have participated — as speakers or
 * audience. Leaders can see which members represented the coalition, on what
 * side, and the collective win/loss record on the debate stage.
 *
 * Distinct from:
 *   /coalitions/[id]/analytics  — statistical overview of stances and influence
 *   /coalitions/[id]/war-room   — campaign planning and active challenges
 *   /debate                     — global debate calendar
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Clock,
  Eye,
  Flame,
  Mic,
  RefreshCw,
  Shield,
  Swords,
  Timer,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  CoalitionDebatesResponse,
  CoalitionDebateEntry,
  CoalitionDebatesStats,
} from '@/app/api/coalitions/[id]/debates/route'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
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

function futureTime(iso: string | null): string {
  if (!iso) return '—'
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Now'
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 60) return `in ${m}m`
  if (h < 24) return `in ${h}h`
  if (d < 7) return `in ${d}d`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const TYPE_LABELS: Record<string, string> = {
  quick: '15m',
  grand: '45m',
  tribunal: '60m',
}

const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; badge: 'proposed' | 'active' | 'law' | 'failed' }
> = {
  scheduled: { label: 'Upcoming', dot: 'bg-for-400', badge: 'proposed' },
  live: { label: 'Live', dot: 'bg-emerald animate-pulse', badge: 'active' },
  ended: { label: 'Ended', dot: 'bg-surface-400', badge: 'failed' },
}

// ─── Tab filter types ──────────────────────────────────────────────────────────

type Tab = 'all' | 'upcoming' | 'live' | 'ended'

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color = 'text-surface-300',
  subtext,
}: {
  label: string
  value: number | string
  icon: typeof Trophy
  color?: string
  subtext?: string
}) {
  return (
    <div className="bg-surface-100/60 border border-surface-200/30 rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-surface-400 text-xs font-medium uppercase tracking-wider">
        <Icon className={cn('h-3.5 w-3.5', color)} />
        {label}
      </div>
      <div className={cn('text-2xl font-bold tabular-nums', color)}>
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </div>
      {subtext && <div className="text-xs text-surface-500">{subtext}</div>}
    </div>
  )
}

// ─── Win/loss pill ─────────────────────────────────────────────────────────────

function WinRatePill({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses
  if (total === 0) return <span className="text-xs text-surface-500 font-mono">No results yet</span>
  const pct = Math.round((wins / total) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex rounded-full overflow-hidden bg-surface-300 w-24">
        <div className="h-full bg-emerald rounded-l-full transition-all" style={{ width: `${pct}%` }} />
        <div className="h-full bg-against-500 rounded-r-full flex-1" />
      </div>
      <span className="text-xs font-mono text-surface-300">
        {wins}W–{losses}L
      </span>
    </div>
  )
}

// ─── Debate card ───────────────────────────────────────────────────────────────

function DebateCard({ debate }: { debate: CoalitionDebateEntry }) {
  const cfg = STATUS_CONFIG[debate.status] ?? STATUS_CONFIG['ended']
  const typeLabel = TYPE_LABELS[debate.type] ?? debate.type
  const isLive = debate.status === 'live'
  const isScheduled = debate.status === 'scheduled'

  // Coalition members on FOR side (blue) and AGAINST side (red)
  const blueSpeakers = debate.coalitionParticipants.filter((p) => p.side === 'blue' && p.isSpeaker)
  const redSpeakers = debate.coalitionParticipants.filter((p) => p.side === 'red' && p.isSpeaker)
  const audienceMembers = debate.coalitionParticipants.filter((p) => !p.isSpeaker)

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'group relative rounded-xl border bg-surface-100/40 hover:bg-surface-100/60 transition-colors overflow-hidden',
        isLive
          ? 'border-emerald/40 shadow-lg shadow-emerald/5'
          : 'border-surface-200/30',
      )}
    >
      {isLive && (
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald via-for-400 to-emerald animate-pulse" />
      )}

      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={cn('h-2 w-2 rounded-full shrink-0', cfg.dot)} />
              <span className="text-xs text-surface-400">{cfg.label}</span>
              <span className="text-xs text-surface-500 font-mono">·</span>
              <span className="text-xs text-surface-400 font-mono">{typeLabel}</span>
              {debate.topic?.category && (
                <>
                  <span className="text-xs text-surface-500 font-mono">·</span>
                  <span className="text-xs text-surface-400">{debate.topic.category}</span>
                </>
              )}
            </div>
            <Link
              href={`/debate/${debate.id}`}
              className="text-sm font-semibold text-white hover:text-for-300 transition-colors line-clamp-2 leading-snug"
            >
              {debate.title}
            </Link>
            {debate.topic && (
              <Link
                href={`/topic/${debate.topic.id}`}
                className="mt-0.5 text-xs text-surface-400 hover:text-surface-300 transition-colors line-clamp-1 block"
              >
                {debate.topic.statement}
              </Link>
            )}
          </div>

          {/* Time / viewer count */}
          <div className="shrink-0 text-right text-xs text-surface-500 space-y-1">
            {isLive ? (
              <div className="flex items-center gap-1 text-emerald text-xs font-semibold">
                <Flame className="h-3 w-3" />
                Live
              </div>
            ) : isScheduled ? (
              <div className="flex items-center gap-1 text-for-400">
                <Timer className="h-3 w-3" />
                {futureTime(debate.scheduledAt)}
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {relativeTime(debate.scheduledAt)}
              </div>
            )}
            {debate.viewerCount > 0 && (
              <div className="flex items-center gap-1 justify-end text-surface-500">
                <Eye className="h-3 w-3" />
                {debate.viewerCount.toLocaleString()}
              </div>
            )}
          </div>
        </div>

        {/* Coalition members */}
        {debate.coalitionParticipants.length > 0 && (
          <div className="border-t border-surface-200/20 pt-3 space-y-2">
            <div className="text-xs text-surface-500 font-medium uppercase tracking-wider flex items-center gap-1">
              <Users className="h-3 w-3" />
              Coalition Members
            </div>

            <div className="flex flex-col gap-2">
              {/* Blue (FOR) speakers */}
              {blueSpeakers.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-for-400 shrink-0 flex items-center gap-1">
                    <Mic className="h-3 w-3" />
                    For
                  </span>
                  {blueSpeakers.map((p) => (
                    <Link
                      key={p.userId}
                      href={`/profile/${p.username}`}
                      className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                    >
                      <Avatar
                        src={p.avatarUrl}
                        fallback={p.displayName ?? p.username}
                        size="xs"
                      />
                      <span className="text-xs text-for-300 font-medium">
                        {p.displayName ?? p.username}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Red (AGAINST) speakers */}
              {redSpeakers.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-against-400 shrink-0 flex items-center gap-1">
                    <Mic className="h-3 w-3" />
                    Against
                  </span>
                  {redSpeakers.map((p) => (
                    <Link
                      key={p.userId}
                      href={`/profile/${p.username}`}
                      className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                    >
                      <Avatar
                        src={p.avatarUrl}
                        fallback={p.displayName ?? p.username}
                        size="xs"
                      />
                      <span className="text-xs text-against-300 font-medium">
                        {p.displayName ?? p.username}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Audience members */}
              {audienceMembers.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-surface-500 shrink-0 flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    Audience
                  </span>
                  <div className="flex -space-x-1.5">
                    {audienceMembers.slice(0, 6).map((p) => (
                      <Link key={p.userId} href={`/profile/${p.username}`} title={p.displayName ?? p.username}>
                        <Avatar
                          src={p.avatarUrl}
                          fallback={p.displayName ?? p.username}
                          size="xs"
                          className="ring-1 ring-surface-900"
                        />
                      </Link>
                    ))}
                    {audienceMembers.length > 6 && (
                      <div className="w-5 h-5 rounded-full bg-surface-200 ring-1 ring-surface-900 flex items-center justify-center text-[9px] text-surface-400 font-mono">
                        +{audienceMembers.length - 6}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sway bar (ended debates) */}
        {debate.status === 'ended' && (debate.blueSway !== 50 || debate.redSway !== 50) && (
          <div className="border-t border-surface-200/20 pt-3">
            <div className="flex justify-between text-xs text-surface-500 mb-1">
              <span className="text-for-400 font-medium">{debate.blueSway}% For</span>
              <span className="text-against-400 font-medium">{debate.redSway}% Against</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-surface-300 flex">
              <div
                className="h-full bg-for-500 rounded-l-full transition-all"
                style={{ width: `${debate.blueSway}%` }}
              />
              <div className="h-full bg-against-500 rounded-r-full flex-1" />
            </div>
          </div>
        )}
      </div>

      {/* View debate link */}
      <Link
        href={`/debate/${debate.id}`}
        className="flex items-center justify-between px-4 py-2.5 border-t border-surface-200/20 text-xs text-surface-500 hover:text-surface-300 hover:bg-surface-200/20 transition-colors"
      >
        <span>View debate</span>
        <span className="text-surface-600">→</span>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function DebateSkeleton() {
  return (
    <div className="rounded-xl border border-surface-200/30 bg-surface-100/40 p-4 space-y-3">
      <div className="flex gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
        <Skeleton className="h-6 w-16 shrink-0" />
      </div>
      <div className="pt-2 border-t border-surface-200/20 flex gap-2">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function CoalitionDebatesPage() {
  const params = useParams<{ id: string }>()
  const coalitionId = params.id

  const [data, setData] = useState<CoalitionDebatesResponse | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      try {
        const statusParam = tab === 'all' ? '' : `?status=${tab}`
        const res = await fetch(`/api/coalitions/${coalitionId}/debates${statusParam}`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error((body as { error?: string }).error ?? 'Failed to load debates')
        }
        const json = await res.json() as CoalitionDebatesResponse
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [coalitionId, tab],
  )

  useEffect(() => {
    void load()
  }, [load])

  const stats: CoalitionDebatesStats | null = data?.stats ?? null

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: stats?.total },
    { id: 'upcoming', label: 'Upcoming', count: stats?.upcoming },
    { id: 'live', label: 'Live', count: stats?.live },
    { id: 'ended', label: 'Past', count: stats?.ended },
  ]

  return (
    <div className="min-h-screen bg-surface-950 text-white">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-4 pb-28 space-y-5">

        {/* Back nav */}
        <div>
          <Link
            href={`/coalitions/${coalitionId}`}
            className="inline-flex items-center gap-1.5 text-sm text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {data?.coalition.name ?? 'Coalition'}
          </Link>
        </div>

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Swords className="h-5 w-5 text-for-400" />
              Debate Stage
            </h1>
            <p className="text-sm text-surface-400 mt-0.5">
              Debates where coalition members have taken the floor
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-2 rounded-lg bg-surface-100/40 border border-surface-200/30 text-surface-400 hover:text-white hover:bg-surface-100/60 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Stats grid */}
        {loading && !data ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Debates" value={stats.total} icon={Swords} color="text-for-400" />
            <StatCard label="Speakers" value={stats.uniqueSpeakers} icon={Mic} color="text-purple" subtext="unique members" />
            <StatCard label="Wins" value={stats.wins} icon={Trophy} color="text-gold" />
            <StatCard label="Losses" value={stats.losses} icon={Shield} color="text-against-400" />
          </div>
        ) : null}

        {/* Win rate */}
        {stats && (stats.wins > 0 || stats.losses > 0) && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-100/40 border border-surface-200/30">
            <div className="flex items-center gap-1.5 text-surface-400 text-sm">
              <Zap className="h-4 w-4 text-gold" />
              <span>Debate record</span>
            </div>
            <WinRatePill wins={stats.wins} losses={stats.losses} />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-surface-100/40 rounded-xl p-1 border border-surface-200/30">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 text-xs font-medium py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1',
                tab === t.id
                  ? 'bg-surface-200 text-white shadow-sm'
                  : 'text-surface-400 hover:text-white',
              )}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span
                  className={cn(
                    'tabular-nums text-[10px] px-1 rounded',
                    tab === t.id ? 'bg-surface-300 text-surface-300' : 'bg-surface-200/40 text-surface-500',
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Debate list */}
        {loading && !data ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <DebateSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div className="text-center py-12 text-surface-400 text-sm">{error}</div>
        ) : data?.debates.length === 0 ? (
          <EmptyState
            icon={Swords}
            title={
              tab === 'live'
                ? 'No live debates'
                : tab === 'upcoming'
                  ? 'No upcoming debates'
                  : tab === 'ended'
                    ? 'No past debates'
                    : 'No debates yet'
            }
            description={
              tab === 'all'
                ? 'Coalition members haven\'t participated in any debates yet. When they do, you\'ll see them here.'
                : tab === 'upcoming'
                  ? 'No debates scheduled. Check back soon — coalition members may be planning their next appearance.'
                  : 'Nothing to show for this filter.'
            }
            actions={
              tab !== 'all'
                ? [{ label: 'View all debates', onClick: () => setTab('all') }]
                : [{ label: 'Browse debates', href: '/debate' }]
            }
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              {data?.debates.map((debate) => (
                <DebateCard key={debate.id} debate={debate} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Footer link */}
        {!loading && data && data.debates.length > 0 && (
          <div className="text-center">
            <Link
              href="/debate"
              className="text-xs text-surface-500 hover:text-surface-300 transition-colors"
            >
              Browse all debates on Lobby Market →
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
