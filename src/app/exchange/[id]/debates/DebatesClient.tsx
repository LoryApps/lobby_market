'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BellOff,
  Calendar,
  ChevronRight,
  Clock,
  Gavel,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  Swords,
  Trophy,
  TrendingDown,
  TrendingUp,
  Users,
  Video,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MarketDebate, MarketDebatesResponse } from '@/app/api/exchange/[id]/debates/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function futureTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Imminent'
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 60) return `in ${m}m`
  if (h < 24) return `in ${h}h ${m % 60}m`
  return `in ${d}d ${h % 24}h`
}

function priceColor(price: number): string {
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

function deltaColor(delta: number): string {
  if (delta > 5) return 'text-for-400'
  if (delta > 0) return 'text-for-500'
  if (delta < -5) return 'text-against-400'
  if (delta < 0) return 'text-against-500'
  return 'text-surface-500'
}

function typeLabel(type: MarketDebate['type']): string {
  if (type === 'quick') return 'Quick'
  if (type === 'grand') return 'Grand'
  if (type === 'tribunal') return 'Tribunal'
  return type
}

function typeVariant(type: MarketDebate['type']): 'gold' | 'default' | 'status' {
  if (type === 'grand') return 'gold'
  if (type === 'tribunal') return 'status'
  return 'default'
}

function winnerLabel(winner: MarketDebate['community_winner']): string {
  if (winner === 'blue') return 'FOR won'
  if (winner === 'red') return 'AGAINST won'
  if (winner === 'tie') return 'Tie'
  return ''
}

function winnerVariant(winner: MarketDebate['community_winner']): 'default' | 'against' | 'status' {
  if (winner === 'blue') return 'status'
  if (winner === 'red') return 'against'
  return 'default'
}

// ─── Debate Card ──────────────────────────────────────────────────────────────

interface DebateCardProps {
  debate: MarketDebate
  onRsvp: (debateId: string, action: 'rsvp' | 'unrsvp') => void
  rsvpLoading: string | null
}

function DebateCard({ debate, onRsvp, rsvpLoading }: DebateCardProps) {
  const isScheduled = debate.status === 'scheduled'
  const isLive = debate.status === 'live'
  const isEnded = debate.status === 'ended'

  const forParticipants = debate.participants.filter((p) => p.side === 'for')
  const againstParticipants = debate.participants.filter((p) => p.side === 'against')

  const totalPollVotes =
    debate.winner_votes.blue + debate.winner_votes.red + debate.winner_votes.tie

  const swayDiff = debate.blue_sway - 50

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative rounded-xl border bg-surface-900 overflow-hidden',
        isLive ? 'border-gold/40 shadow-[0_0_16px_rgba(212,175,55,0.08)]' : 'border-surface-700/60',
      )}
    >
      {/* Live pulse */}
      {isLive && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-gold" />
          </span>
          <span className="text-xs font-bold tracking-wide text-gold uppercase">Live</span>
        </div>
      )}

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          <div className={cn(
            'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center',
            isLive ? 'bg-gold/10' : isEnded ? 'bg-surface-700' : 'bg-surface-700',
          )}>
            {isLive ? (
              <Video className="w-4 h-4 text-gold" />
            ) : isEnded ? (
              <Gavel className="w-4 h-4 text-surface-400" />
            ) : (
              <Calendar className="w-4 h-4 text-surface-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <Badge variant={typeVariant(debate.type)} size="xs">
                {typeLabel(debate.type)}
              </Badge>
              {isEnded && debate.community_winner && (
                <Badge variant={winnerVariant(debate.community_winner)} size="xs">
                  <Trophy className="w-2.5 h-2.5 mr-0.5" />
                  {winnerLabel(debate.community_winner)}
                </Badge>
              )}
            </div>
            <h3 className="text-sm font-semibold text-surface-100 leading-snug line-clamp-2">
              {debate.title}
            </h3>
          </div>
        </div>

        {/* Participants */}
        {debate.participants.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1 flex-1 min-w-0">
              {/* FOR side */}
              <div className="flex -space-x-1.5">
                {forParticipants.slice(0, 2).map((p) => (
                  <Avatar
                    key={p.user_id}
                    src={p.avatar_url ?? undefined}
                    username={p.username}
                    size="xs"
                    className="ring-1 ring-surface-900"
                  />
                ))}
              </div>
              <span className="text-xs text-for-400 font-medium truncate">
                {forParticipants.map((p) => p.display_name || p.username).join(', ') || 'FOR'}
              </span>
            </div>
            <div className="flex-shrink-0">
              <Swords className="w-3.5 h-3.5 text-surface-600" />
            </div>
            <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
              <span className="text-xs text-against-400 font-medium truncate text-right">
                {againstParticipants.map((p) => p.display_name || p.username).join(', ') || 'AGAINST'}
              </span>
              <div className="flex -space-x-1.5">
                {againstParticipants.slice(0, 2).map((p) => (
                  <Avatar
                    key={p.user_id}
                    src={p.avatar_url ?? undefined}
                    username={p.username}
                    size="xs"
                    className="ring-1 ring-surface-900"
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Sway bar (for live/ended debates) */}
        {(isLive || isEnded) && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-surface-500 mb-1">
              <span className="text-for-400 font-medium">{debate.blue_sway}% FOR</span>
              <span className="text-surface-500 text-[10px]">Audience sway</span>
              <span className="text-against-400 font-medium">{debate.red_sway}% AGAINST</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-700 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-for-500 to-for-400 transition-all duration-700"
                style={{ width: `${debate.blue_sway}%` }}
              />
            </div>
            {isEnded && swayDiff !== 0 && (
              <p className="text-[11px] text-surface-500 mt-1">
                {swayDiff > 0
                  ? `FOR side led audience sway by ${swayDiff}pts`
                  : `AGAINST side led audience sway by ${Math.abs(swayDiff)}pts`}
              </p>
            )}
          </div>
        )}

        {/* Price impact (for ended debates) */}
        {isEnded && debate.price_before !== null && debate.price_after !== null && (
          <div className="flex items-center gap-2 mb-3 p-2.5 rounded-lg bg-surface-800 border border-surface-700/60">
            <div className="text-center">
              <p className="text-[10px] text-surface-500 uppercase tracking-wide mb-0.5">Before</p>
              <p className={cn('text-sm font-bold tabular-nums', priceColor(debate.price_before))}>
                {debate.price_before}¢
              </p>
            </div>
            <div className="flex-1 flex items-center justify-center gap-1">
              {debate.price_delta !== null && (
                <>
                  {debate.price_delta > 0 ? (
                    <TrendingUp className="w-4 h-4 text-for-400" />
                  ) : debate.price_delta < 0 ? (
                    <TrendingDown className="w-4 h-4 text-against-400" />
                  ) : (
                    <Scale className="w-4 h-4 text-surface-500" />
                  )}
                  <span className={cn('text-xs font-bold', deltaColor(debate.price_delta))}>
                    {debate.price_delta > 0 ? '+' : ''}{debate.price_delta}¢
                  </span>
                </>
              )}
            </div>
            <div className="text-center">
              <p className="text-[10px] text-surface-500 uppercase tracking-wide mb-0.5">After</p>
              <p className={cn('text-sm font-bold tabular-nums', priceColor(debate.price_after))}>
                {debate.price_after}¢
              </p>
            </div>
          </div>
        )}

        {/* Winner poll results (for ended debates) */}
        {isEnded && totalPollVotes > 0 && (
          <div className="mb-3 space-y-1.5">
            <p className="text-[11px] text-surface-500 uppercase tracking-wide">Community verdict</p>
            {(['blue', 'red', 'tie'] as const).map((side) => {
              const count = debate.winner_votes[side]
              const pct = totalPollVotes > 0 ? Math.round((count / totalPollVotes) * 100) : 0
              const isWinner = side === debate.community_winner
              return (
                <div key={side} className="flex items-center gap-2">
                  <span className={cn(
                    'text-xs font-medium w-20',
                    side === 'blue' ? 'text-for-400' : side === 'red' ? 'text-against-400' : 'text-surface-500',
                  )}>
                    {side === 'blue' ? 'FOR' : side === 'red' ? 'AGAINST' : 'Tie'}
                  </span>
                  <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-700',
                        side === 'blue' ? 'bg-for-500' : side === 'red' ? 'bg-against-500' : 'bg-surface-500',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className={cn(
                    'text-xs tabular-nums w-10 text-right',
                    isWinner ? 'text-surface-100 font-bold' : 'text-surface-500',
                  )}>
                    {pct}%
                  </span>
                  {isWinner && <Trophy className="w-3 h-3 text-gold flex-shrink-0" />}
                </div>
              )
            })}
          </div>
        )}

        {/* Footer: stats + actions */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-surface-800">
          <div className="flex items-center gap-3">
            {/* Date/time */}
            <div className="flex items-center gap-1 text-xs text-surface-500">
              <Clock className="w-3 h-3" />
              {isScheduled
                ? futureTime(debate.scheduled_at)
                : isLive
                  ? 'Started ' + relTime(debate.started_at ?? debate.scheduled_at)
                  : relTime(debate.ended_at ?? debate.scheduled_at)
              }
            </div>
            {/* RSVP count */}
            {debate.rsvp_count > 0 && (
              <div className="flex items-center gap-1 text-xs text-surface-500">
                <Users className="w-3 h-3" />
                {debate.rsvp_count}
              </div>
            )}
            {/* Message count */}
            {debate.message_count > 0 && (
              <div className="flex items-center gap-1 text-xs text-surface-500">
                <MessageSquare className="w-3 h-3" />
                {debate.message_count}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* RSVP button for scheduled debates */}
            {isScheduled && (
              <button
                onClick={() => onRsvp(debate.id, debate.user_rsvped ? 'unrsvp' : 'rsvp')}
                disabled={rsvpLoading === debate.id}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border',
                  debate.user_rsvped
                    ? 'bg-for-600/20 border-for-500/30 text-for-400 hover:bg-for-600/10'
                    : 'bg-surface-800 border-surface-600 text-surface-400 hover:text-surface-200 hover:border-surface-500',
                )}
              >
                {rsvpLoading === debate.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : debate.user_rsvped ? (
                  <BellOff className="w-3 h-3" />
                ) : (
                  <Bell className="w-3 h-3" />
                )}
                {debate.user_rsvped ? 'Cancel RSVP' : 'RSVP'}
              </button>
            )}

            {/* Watch button for live debates */}
            {isLive && (
              <Link
                href={`/debate/${debate.id}`}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20 transition-colors"
              >
                <Video className="w-3 h-3" />
                Watch Live
              </Link>
            )}

            {/* View button for ended debates */}
            {isEnded && (
              <Link
                href={`/debate/${debate.id}`}
                className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-300 transition-colors"
              >
                View
                <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DebateSkeleton() {
  return (
    <div className="rounded-xl border border-surface-700/60 bg-surface-900 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="w-9 h-9 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="flex justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'scheduled', label: 'Upcoming' },
  { id: 'live', label: 'Live' },
  { id: 'ended', label: 'Ended' },
] as const

type FilterId = (typeof FILTERS)[number]['id']

interface Props {
  topicId: string
}

export function DebatesClient({ topicId }: Props) {
  const [data, setData] = useState<MarketDebatesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterId>('all')
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch(`/api/exchange/${topicId}/debates`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      setData(json)
    } catch {
      setError('Failed to load debates')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  async function handleRsvp(debateId: string, action: 'rsvp' | 'unrsvp') {
    if (!data) return
    setRsvpLoading(debateId)
    try {
      await fetch(`/api/exchange/${topicId}/debates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debate_id: debateId, action }),
      })
      // Optimistic update
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          debates: prev.debates.map((d) =>
            d.id === debateId
              ? {
                  ...d,
                  user_rsvped: action === 'rsvp',
                  rsvp_count: d.rsvp_count + (action === 'rsvp' ? 1 : -1),
                }
              : d
          ),
        }
      })
    } catch {
      // best-effort
    } finally {
      setRsvpLoading(null)
    }
  }

  const filtered = data?.debates.filter((d) => {
    if (filter === 'all') return true
    return d.status === filter
  }) ?? []

  const topic = data?.topic

  return (
    <div className="min-h-screen bg-surface-950 pb-24">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-4">
        {/* Back nav */}
        <div className="flex items-center gap-3 mb-4">
          <Link
            href={`/exchange/${topicId}`}
            className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Market
          </Link>
          {topic && (
            <>
              <span className="text-surface-700">/</span>
              <span className="text-sm text-surface-400 truncate max-w-[200px]">
                {topic.statement.slice(0, 40)}{topic.statement.length > 40 ? '…' : ''}
              </span>
            </>
          )}
        </div>

        {/* Page header */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <Swords className="w-5 h-5 text-surface-400" />
            <h1 className="text-xl font-bold text-surface-100">Market Debates</h1>
          </div>
          {topic && (
            <p className="text-sm text-surface-500 line-clamp-2">{topic.statement}</p>
          )}
        </div>

        {/* Stats row */}
        {data && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Scheduled', value: data.scheduled_count, icon: Calendar, color: 'text-surface-400' },
              { label: 'Live Now', value: data.live_count, icon: Video, color: 'text-gold' },
              { label: 'Completed', value: data.ended_count, icon: Gavel, color: 'text-surface-400' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-surface-900 border border-surface-700/60 p-3 text-center">
                <stat.icon className={cn('w-4 h-4 mx-auto mb-1', stat.color)} />
                <p className={cn('text-lg font-bold tabular-nums', stat.value > 0 && stat.label === 'Live Now' ? 'text-gold' : 'text-surface-100')}>
                  {stat.value}
                </p>
                <p className="text-xs text-surface-500">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 mb-4 p-1 bg-surface-900 rounded-xl border border-surface-700/60">
          {FILTERS.map((f) => {
            const count = f.id === 'all'
              ? data?.total ?? 0
              : f.id === 'scheduled'
                ? data?.scheduled_count ?? 0
                : f.id === 'live'
                  ? data?.live_count ?? 0
                  : data?.ended_count ?? 0
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  filter === f.id
                    ? 'bg-surface-700 text-surface-100'
                    : 'text-surface-500 hover:text-surface-300',
                )}
              >
                {f.label}
                {count > 0 && (
                  <span className={cn(
                    'ml-1 text-[10px]',
                    filter === f.id ? 'text-surface-300' : 'text-surface-600',
                  )}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Refresh */}
        <div className="flex justify-end mb-3">
          <button
            onClick={() => { setLoading(true); load() }}
            className="flex items-center gap-1 text-xs text-surface-600 hover:text-surface-400 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <DebateSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-against-500/20 bg-against-900/10 p-6 text-center">
            <p className="text-sm text-against-400">{error}</p>
            <button onClick={load} className="mt-2 text-xs text-surface-500 hover:text-surface-300">
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Swords}
            title={filter === 'all' ? 'No debates yet' : `No ${filter} debates`}
            description={
              filter === 'scheduled'
                ? 'No debates are scheduled for this market yet.'
                : filter === 'live'
                  ? 'No debates are live right now.'
                  : filter === 'ended'
                    ? 'No completed debates for this market.'
                    : 'No debates have been created for this market yet.'
            }
            action={
              filter !== 'all'
                ? { label: 'View all', onClick: () => setFilter('all') }
                : undefined
            }
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {filtered.map((debate) => (
                <DebateCard
                  key={debate.id}
                  debate={debate}
                  onRsvp={handleRsvp}
                  rsvpLoading={rsvpLoading}
                />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* CTA: Create a debate */}
        {!loading && !error && data && (
          <div className="mt-6 rounded-xl border border-surface-700/60 bg-surface-900 p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-surface-200">Start a debate</p>
              <p className="text-xs text-surface-500">Challenge the market — schedule a structured debate on this topic.</p>
            </div>
            <Link
              href={`/topic/${topicId}/debate/new`}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-700 hover:bg-surface-600 transition-colors text-sm font-medium text-surface-200"
            >
              <Zap className="w-4 h-4 text-gold" />
              Debate
            </Link>
          </div>
        )}

        {/* Link to all debates */}
        {!loading && !error && (
          <Link
            href="/debates"
            className="mt-3 flex items-center justify-center gap-2 text-sm text-surface-500 hover:text-surface-300 transition-colors py-3"
          >
            Browse all debates
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
