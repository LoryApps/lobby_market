'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
  Loader2,
  RefreshCw,
  Sparkles,
  Tag,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { Tournament, TournamentsResponse } from '@/app/api/exchange/tournaments/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

function daysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
}

function statusColor(status: Tournament['status']): string {
  switch (status) {
    case 'active':   return 'text-emerald'
    case 'upcoming': return 'text-for-400'
    case 'finished': return 'text-surface-500'
  }
}

function statusLabel(status: Tournament['status']): string {
  switch (status) {
    case 'active':   return 'LIVE'
    case 'upcoming': return 'UPCOMING'
    case 'finished': return 'ENDED'
  }
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-for-300',
  Philosophy:  'text-against-300',
  Culture:     'text-purple',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-400',
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TournamentSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-3 w-80" />
            </div>
            <Skeleton className="h-9 w-24 rounded-xl flex-shrink-0" />
          </div>
          <div className="mt-4 flex gap-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Tournament Card ──────────────────────────────────────────────────────────

interface TournamentCardProps {
  tournament: Tournament
  onJoin: (id: string) => Promise<void>
  joining: string | null
}

function TournamentCard({ tournament: t, onJoin, joining }: TournamentCardProps) {
  const isJoining = joining === t.id

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border transition-all',
        t.status === 'active'
          ? 'bg-surface-100 border-emerald/30 hover:border-emerald/50'
          : t.status === 'upcoming'
          ? 'bg-surface-100 border-for-500/20 hover:border-for-500/40'
          : 'bg-surface-100/60 border-surface-300',
      )}
    >
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Status + category */}
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={cn(
                  'text-[10px] font-mono font-bold tracking-widest',
                  statusColor(t.status),
                )}
              >
                {statusLabel(t.status)}
              </span>
              {t.category && (
                <>
                  <span className="text-surface-600">·</span>
                  <span
                    className={cn(
                      'text-[10px] font-mono',
                      CATEGORY_COLORS[t.category] ?? 'text-surface-400',
                    )}
                  >
                    <Tag className="h-2.5 w-2.5 inline mr-0.5 -mt-px" />
                    {t.category}
                  </span>
                </>
              )}
              {t.status === 'active' && (
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald animate-pulse ml-0.5" />
              )}
            </div>

            {/* Title */}
            <h3 className="text-base font-semibold text-white leading-snug mb-1">
              {t.title}
            </h3>

            {/* Description */}
            {t.description && (
              <p className="text-xs text-surface-400 leading-relaxed line-clamp-2">
                {t.description}
              </p>
            )}
          </div>

          {/* CTA */}
          <div className="flex-shrink-0 flex flex-col items-end gap-2">
            {t.status === 'finished' ? (
              <Link
                href={`/exchange/tournaments/${t.id}`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-surface-400 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-300 transition-all"
              >
                Results <ChevronRight className="h-3 w-3" />
              </Link>
            ) : t.user_entered ? (
              <div className="flex flex-col items-end gap-1">
                <span className="flex items-center gap-1 text-xs font-mono text-emerald">
                  <CheckCircle2 className="h-3 w-3" />
                  Entered
                </span>
                {t.user_rank && (
                  <span className="text-[10px] font-mono text-surface-500">
                    Rank #{t.user_rank}
                  </span>
                )}
                <Link
                  href={`/exchange/tournaments/${t.id}`}
                  className="flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-white transition-colors mt-0.5"
                >
                  View standings <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <button
                onClick={() => onJoin(t.id)}
                disabled={isJoining}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all',
                  t.status === 'active'
                    ? 'bg-emerald/15 border border-emerald/40 text-emerald hover:bg-emerald/25 hover:border-emerald/60'
                    : 'bg-for-500/15 border border-for-500/30 text-for-400 hover:bg-for-500/25 hover:border-for-500/50',
                  isJoining && 'opacity-60 cursor-not-allowed',
                )}
              >
                {isJoining ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : t.status === 'active' ? (
                  <Zap className="h-3 w-3" />
                ) : (
                  <Calendar className="h-3 w-3" />
                )}
                {isJoining ? 'Joining…' : t.status === 'active' ? 'Join Now' : 'Pre-register'}
              </button>
            )}
          </div>
        </div>

        {/* Footer stats */}
        <div className="mt-4 pt-3 border-t border-surface-300/60 flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <Users className="h-3 w-3" />
            {t.entry_count.toLocaleString()} participant{t.entry_count !== 1 ? 's' : ''}
          </span>

          {t.status === 'active' ? (
            <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <Clock className="h-3 w-3" />
              {daysLeft(t.ends_at)} day{daysLeft(t.ends_at) !== 1 ? 's' : ''} left
            </span>
          ) : t.status === 'upcoming' ? (
            <span className="flex items-center gap-1 text-[11px] font-mono text-for-400">
              <Clock className="h-3 w-3" />
              Starts in {daysUntil(t.starts_at)} day{daysUntil(t.starts_at) !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <Clock className="h-3 w-3" />
              Ended {formatDate(t.ends_at)}
            </span>
          )}

          {t.prize_description && (
            <span className="flex items-center gap-1 text-[11px] font-mono text-gold">
              <Trophy className="h-3 w-3" />
              {t.prize_description}
            </span>
          )}
        </div>

        {/* User score bar (if entered and active) */}
        {t.user_entered && t.user_score !== null && t.status === 'active' && (
          <div className="mt-3 pt-3 border-t border-surface-300/40 flex items-center gap-3">
            <span className="text-[11px] font-mono text-surface-500">Your score</span>
            <div className="flex-1 h-1 rounded-full bg-surface-300">
              <div
                className="h-full rounded-full bg-for-500 transition-all"
                style={{ width: `${Math.min(100, t.user_score)}%` }}
              />
            </div>
            <span className="text-[11px] font-mono font-semibold text-for-400">
              {t.user_score.toFixed(1)}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  label,
  count,
  color = 'text-surface-300',
}: {
  icon: typeof Trophy
  label: string
  count: number
  color?: string
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={cn('h-4 w-4', color)} />
      <h2 className={cn('text-xs font-mono font-bold uppercase tracking-widest', color)}>
        {label}
      </h2>
      <span className="text-[10px] font-mono text-surface-500 ml-1">({count})</span>
    </div>
  )
}

// ─── Main Client ──────────────────────────────────────────────────────────────

export function TournamentsClient() {
  const router = useRouter()
  const [data, setData] = useState<TournamentsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [joining, setJoining] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch('/api/exchange/tournaments')
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleJoin = useCallback(async (id: string) => {
    setJoining(id)
    setJoinError(null)
    try {
      const res = await fetch('/api/exchange/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournament_id: id }),
      })
      if (res.status === 401) {
        router.push('/auth/login')
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        setJoinError(body.error ?? 'Failed to join')
        return
      }
      // Optimistic update
      setData((prev) => {
        if (!prev) return prev
        const update = (list: Tournament[]) =>
          list.map((t) =>
            t.id === id ? { ...t, user_entered: true, entry_count: t.entry_count + 1 } : t
          )
        return {
          active:   update(prev.active),
          upcoming: update(prev.upcoming),
          finished: prev.finished,
        }
      })
    } catch {
      setJoinError('Network error — try again')
    } finally {
      setJoining(null)
    }
  }, [router])

  const total =
    (data?.active.length ?? 0) +
    (data?.upcoming.length ?? 0) +
    (data?.finished.length ?? 0)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-32 md:pb-12">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/exchange"
            className="p-2 rounded-xl border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-gold" />
              <h1 className="text-lg font-bold text-white">Prediction Tournaments</h1>
            </div>
            <p className="text-xs text-surface-500 font-mono mt-0.5">
              Compete to forecast civic consensus — earn badges, Clout, and glory
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-2 rounded-xl border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* How it works strip */}
        <div className="rounded-2xl border border-surface-300/60 bg-surface-100/60 p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-gold" />
            <span className="text-[11px] font-mono font-bold text-gold uppercase tracking-widest">
              How tournaments work
            </span>
          </div>
          <p className="text-xs text-surface-400 leading-relaxed">
            Join a tournament, then cast votes and make price forecasts on civic markets within the
            competition window. Your score is calculated from prediction accuracy — the closer your
            price forecast is to the final resolved consensus, the higher you rank.{' '}
            <Link href="/exchange/performance" className="text-for-400 hover:text-for-300 underline underline-offset-2">
              View your accuracy stats
            </Link>
          </p>
        </div>

        {/* Error message */}
        <AnimatePresence>
          {joinError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-against-500/40 bg-against-500/10 p-3 mb-4 text-xs font-mono text-against-300"
            >
              {joinError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        {loading ? (
          <TournamentSkeleton />
        ) : total === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No tournaments yet"
            description="Check back soon — prediction tournaments are coming to the Exchange."
          />
        ) : (
          <div className="space-y-8">
            {/* Active tournaments */}
            {(data?.active.length ?? 0) > 0 && (
              <section>
                <SectionHeader
                  icon={Flame}
                  label="Live now"
                  count={data!.active.length}
                  color="text-emerald"
                />
                <div className="space-y-3">
                  {data!.active.map((t) => (
                    <TournamentCard
                      key={t.id}
                      tournament={t}
                      onJoin={handleJoin}
                      joining={joining}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Upcoming tournaments */}
            {(data?.upcoming.length ?? 0) > 0 && (
              <section>
                <SectionHeader
                  icon={Calendar}
                  label="Upcoming"
                  count={data!.upcoming.length}
                  color="text-for-400"
                />
                <div className="space-y-3">
                  {data!.upcoming.map((t) => (
                    <TournamentCard
                      key={t.id}
                      tournament={t}
                      onJoin={handleJoin}
                      joining={joining}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Finished tournaments */}
            {(data?.finished.length ?? 0) > 0 && (
              <section>
                <SectionHeader
                  icon={Trophy}
                  label="Completed"
                  count={data!.finished.length}
                  color="text-surface-500"
                />
                <div className="space-y-3">
                  {data!.finished.map((t) => (
                    <TournamentCard
                      key={t.id}
                      tournament={t}
                      onJoin={handleJoin}
                      joining={joining}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
