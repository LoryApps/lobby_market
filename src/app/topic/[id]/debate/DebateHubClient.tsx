'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  Clock,
  Crown,
  Eye,
  Mic,
  Plus,
  RefreshCw,
  Users,
  Zap,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { DebateRSVPButton } from '@/components/debate/DebateRSVPButton'
import { cn } from '@/lib/utils/cn'
import type { DebateHubEntry, DebateHubResponse } from '@/app/api/topics/[id]/debate-hub/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatScheduled(iso: string | null): string {
  if (!iso) return ''
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Starting now'
  const m = Math.round(diff / 60_000)
  const h = Math.round(m / 60)
  const d = Math.round(h / 24)
  if (m < 60) return `in ${m}m`
  if (h < 24) return `in ${h}h`
  if (d === 1) return 'tomorrow'
  if (d < 7) return `in ${d}d`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatEnded(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (h < 1) return 'just ended'
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const TYPE_LABEL: Record<string, string> = {
  oxford: 'Oxford',
  town_hall: 'Town Hall',
  rapid_fire: 'Rapid Fire',
  panel: 'Panel',
  quick: 'Quick',
  grand: 'Grand',
  tribunal: 'Tribunal',
}

type TabId = 'all' | 'live' | 'scheduled' | 'ended'

// ─── Debate Card ──────────────────────────────────────────────────────────────

function DebateCard({ debate }: { debate: DebateHubEntry }) {
  const isLive = debate.status === 'live'
  const isScheduled = debate.status === 'scheduled'
  const isEnded = debate.status === 'ended'

  const forParticipants = debate.participants.filter((p) => p.side === 'blue' && p.is_speaker)
  const againstParticipants = debate.participants.filter((p) => p.side === 'red' && p.is_speaker)

  return (
    <Link
      href={`/debate/${debate.id}`}
      className={cn(
        'group flex items-start gap-3 p-4 rounded-xl border transition-colors',
        isLive
          ? 'bg-for-500/8 border-for-500/25 hover:bg-for-500/12'
          : isScheduled
          ? 'bg-surface-200/60 border-surface-300/60 hover:bg-surface-200'
          : 'bg-surface-200/40 border-surface-300/40 hover:bg-surface-200/60'
      )}
    >
      {/* Status icon */}
      <div
        className={cn(
          'flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl mt-0.5',
          isLive
            ? 'bg-for-500/15 border border-for-500/30'
            : isScheduled
            ? 'bg-surface-300/60 border border-surface-400/40'
            : 'bg-surface-300/40 border border-surface-400/30'
        )}
      >
        {isLive ? (
          <Zap className="h-5 w-5 text-for-400" />
        ) : isScheduled ? (
          <Calendar className="h-5 w-5 text-surface-500" />
        ) : (
          <Mic className="h-5 w-5 text-surface-600" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm font-medium leading-snug', isEnded ? 'text-surface-500' : 'text-white')}>
            {debate.title}
          </p>
          <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-500 flex-shrink-0 transition-colors mt-0.5" />
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
          <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
            {TYPE_LABEL[debate.type] ?? debate.type}
          </span>

          {isLive && (
            <span className="flex items-center gap-1 text-[11px] font-mono text-for-400 font-semibold">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-for-400 animate-pulse" />
              LIVE
            </span>
          )}

          {isLive && debate.viewer_count > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <Eye className="h-3 w-3" />
              {debate.viewer_count} watching
            </span>
          )}

          {isScheduled && debate.scheduled_at && (
            <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <Clock className="h-3 w-3" />
              {formatScheduled(debate.scheduled_at)}
            </span>
          )}

          {isScheduled && debate.rsvp_count > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <Users className="h-3 w-3" />
              {debate.rsvp_count} attending
            </span>
          )}

          {isEnded && debate.scheduled_at && (
            <span className="text-[11px] font-mono text-surface-600">
              {formatEnded(debate.scheduled_at)}
            </span>
          )}
        </div>

        {/* Participants + sway + RSVP */}
        {(debate.participants.length > 0 || isScheduled || (isLive && debate.viewer_count > 0)) && (
          <div className="flex items-center justify-between mt-2.5 flex-wrap gap-2">
            {/* Participant avatars + open seat indicators */}
            <div className="flex items-center gap-3">
              {forParticipants.length > 0 ? (
                <div className="flex items-center gap-1.5">
                  <div className="flex -space-x-1.5">
                    {forParticipants.slice(0, 3).map((p) => (
                      <Avatar
                        key={p.id}
                        src={p.avatar_url}
                        fallback={p.display_name || p.username || '?'}
                        size="xs"
                        className="ring-1 ring-for-600"
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-mono text-for-400">FOR</span>
                </div>
              ) : isScheduled ? (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-dashed border-for-500/40 text-[10px] font-mono text-for-500/60">
                  <Mic className="h-2.5 w-2.5" />
                  FOR open
                </span>
              ) : null}
              {(forParticipants.length > 0 || isScheduled) && (againstParticipants.length > 0 || isScheduled) && (
                <span className="text-[10px] text-surface-600">vs</span>
              )}
              {againstParticipants.length > 0 ? (
                <div className="flex items-center gap-1.5">
                  <div className="flex -space-x-1.5">
                    {againstParticipants.slice(0, 3).map((p) => (
                      <Avatar
                        key={p.id}
                        src={p.avatar_url}
                        fallback={p.display_name || p.username || '?'}
                        size="xs"
                        className="ring-1 ring-against-600"
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-mono text-against-400">AGAINST</span>
                </div>
              ) : isScheduled ? (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-dashed border-against-500/40 text-[10px] font-mono text-against-500/60">
                  <Mic className="h-2.5 w-2.5" />
                  AGAINST open
                </span>
              ) : null}

              {/* Sway result for ended debates */}
              {isEnded && (debate.blue_sway !== 50 || debate.red_sway !== 50) && (
                <div className="flex items-center gap-1">
                  <Crown className="h-3 w-3 text-gold" />
                  <span className="text-[10px] font-mono text-gold">
                    {debate.blue_sway > debate.red_sway
                      ? `FOR won ${debate.blue_sway}%`
                      : `AGAINST won ${debate.red_sway}%`}
                  </span>
                </div>
              )}

              {/* Audience sway bar for live debates */}
              {isLive && debate.viewer_count > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-for-400">{Math.round(debate.blue_sway)}%</span>
                  <div className="w-16 h-1.5 rounded-full bg-surface-300 overflow-hidden">
                    <div
                      className="h-full bg-for-500 rounded-full"
                      style={{ width: `${debate.blue_sway}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-against-400">{Math.round(debate.red_sway)}%</span>
                </div>
              )}
            </div>

            {/* RSVP button for scheduled debates — always visible */}
            {isScheduled && (
              <DebateRSVPButton
                debateId={debate.id}
                initialCount={debate.rsvp_count}
                size="sm"
              />
            )}
          </div>
        )}
      </div>
    </Link>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-200/60 border border-surface-300/50">
      <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
        <div className="flex gap-2 mt-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  topicId: string
}

export function DebateHubClient({ topicId }: Props) {
  const [data, setData] = useState<DebateHubResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('all')

  const load = useCallback(async () => {
    setError(false)
    try {
      const res = await fetch(`/api/topics/${topicId}/debate-hub`, { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  const filtered = data?.debates.filter((d) => {
    if (activeTab === 'all') return true
    if (activeTab === 'live') return d.status === 'live'
    if (activeTab === 'scheduled') return d.status === 'scheduled'
    if (activeTab === 'ended') return d.status === 'ended'
    return true
  }) ?? []

  const tabs: { id: TabId; label: string; count: number }[] = data
    ? [
        { id: 'all', label: 'All', count: data.counts.total },
        { id: 'live', label: 'Live', count: data.counts.live },
        { id: 'scheduled', label: 'Upcoming', count: data.counts.scheduled },
        { id: 'ended', label: 'Past', count: data.counts.ended },
      ]
    : []

  return (
    <div className="min-h-screen bg-surface-50">
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back + header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div className="flex items-start gap-3">
            <Link
              href={`/topic/${topicId}`}
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors flex-shrink-0 mt-0.5"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-for-400 flex-shrink-0" />
                <h1 className="font-mono text-lg font-bold text-white">Debates</h1>
              </div>
              {data && (
                <p className="text-xs font-mono text-surface-500 mt-0.5 line-clamp-2">
                  {data.topic_statement}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={load}
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <Link
              href={`/debate/create?topic=${topicId}`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-for-600/20 border border-for-500/30 text-for-300 hover:bg-for-600/30 hover:text-for-200 transition-colors text-xs font-mono font-medium"
            >
              <Plus className="h-3.5 w-3.5" />
              Schedule
            </Link>
          </div>
        </div>

        {/* Tabs */}
        {!loading && !error && data && (
          <div className="flex items-center gap-1 mb-5 border-b border-surface-300 overflow-x-auto">
            {tabs.filter((t) => t.id === 'all' || t.count > 0).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                  activeTab === tab.id
                    ? 'border-for-400 text-for-300'
                    : 'border-transparent text-surface-500 hover:text-surface-400'
                )}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={cn(
                    'inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold',
                    tab.id === 'live' && tab.count > 0
                      ? 'bg-for-500/20 text-for-400'
                      : 'bg-surface-300 text-surface-500'
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {loading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <CardSkeleton key={i} />)}
          </div>
        )}

        {error && (
          <div className="py-12 text-center">
            <p className="text-sm font-mono text-against-400">Failed to load debates.</p>
            <button
              type="button"
              onClick={load}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <AnimatePresence mode="wait">
            {filtered.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <EmptyState
                  icon={Mic}
                  title={
                    activeTab === 'all'
                      ? 'No debates yet'
                      : activeTab === 'live'
                      ? 'No live debates'
                      : activeTab === 'scheduled'
                      ? 'No upcoming debates'
                      : 'No past debates'
                  }
                  description={
                    activeTab === 'all'
                      ? 'Be the first to open the floor on this topic.'
                      : 'Switch to another tab or check back later.'
                  }
                  action={
                    activeTab === 'all'
                      ? {
                          label: 'Schedule a Debate',
                          href: `/debate/create?topic=${topicId}`,
                        }
                      : undefined
                  }
                />
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {filtered.map((debate) => (
                  <DebateCard key={debate.id} debate={debate} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>
    </div>
  )
}
