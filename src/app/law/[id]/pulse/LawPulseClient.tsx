'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  BookOpen,
  Flame,
  Gavel,
  Layers,
  MessageSquare,
  Play,
  RefreshCw,
  Star,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { LawPulseData, PulseEvent, PulseEventKind } from '@/app/api/laws/[id]/pulse/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_MS = 20_000

// ─── Event config ─────────────────────────────────────────────────────────────

const KIND_CONFIG: Record<PulseEventKind, {
  icon: typeof Activity
  label: string
  iconColor: string
  bgColor: string
  borderColor: string
}> = {
  review: {
    icon: Star,
    label: 'Review',
    iconColor: 'text-gold',
    bgColor: 'bg-gold/10',
    borderColor: 'border-gold/25',
  },
  chat: {
    icon: MessageSquare,
    label: 'Discussion',
    iconColor: 'text-for-400',
    bgColor: 'bg-for-500/8',
    borderColor: 'border-for-500/20',
  },
  wiki_edit: {
    icon: BookOpen,
    label: 'Wiki Edit',
    iconColor: 'text-emerald',
    bgColor: 'bg-emerald/8',
    borderColor: 'border-emerald/20',
  },
  challenge: {
    icon: Gavel,
    label: 'Challenge',
    iconColor: 'text-against-400',
    bgColor: 'bg-against-500/8',
    borderColor: 'border-against-500/20',
  },
  amendment: {
    icon: Layers,
    label: 'Amendment',
    iconColor: 'text-purple',
    bgColor: 'bg-purple/8',
    borderColor: 'border-purple/20',
  },
}

const ENGAGEMENT_CONFIG: Record<LawPulseData['engagement_label'], {
  label: string
  color: string
  dot: string
  desc: string
}> = {
  thriving: {
    label: 'Thriving',
    color: 'text-emerald',
    dot: 'bg-emerald animate-pulse',
    desc: 'High community activity in the last 7 days',
  },
  active: {
    label: 'Active',
    color: 'text-for-400',
    dot: 'bg-for-400 animate-pulse',
    desc: 'Regular engagement from the community',
  },
  quiet: {
    label: 'Quiet',
    color: 'text-gold',
    dot: 'bg-gold',
    desc: 'Some recent activity but mostly settled',
  },
  dormant: {
    label: 'Dormant',
    color: 'text-surface-500',
    dot: 'bg-surface-500',
    desc: 'Little recent community engagement',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function StarRating({ stars }: { stars: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${stars} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'h-3 w-3',
            i < stars ? 'text-gold fill-gold' : 'text-surface-600 fill-surface-600'
          )}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({ event, isNew }: { event: PulseEvent; isNew: boolean }) {
  const cfg = KIND_CONFIG[event.kind]
  const Icon = cfg.icon
  const grounds: Record<string, string> = {
    constitutional: 'Constitutional',
    procedural: 'Procedural',
    factual: 'Factual',
    ethical: 'Ethical',
    practical: 'Practical',
  }
  const amendmentStatus: Record<string, string> = {
    pending: 'Pending',
    ratified: 'Ratified',
    rejected: 'Rejected',
  }

  return (
    <motion.article
      layout
      initial={isNew ? { opacity: 0, y: -10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'rounded-xl border p-3.5 space-y-2 transition-colors',
        cfg.bgColor,
        cfg.borderColor,
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <div className={cn('flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center', cfg.bgColor)}>
          <Icon className={cn('h-3.5 w-3.5', cfg.iconColor)} aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-[10px] font-mono font-bold uppercase tracking-wider', cfg.iconColor)}>
              {cfg.label}
            </span>
            {event.kind === 'review' && event.stars && (
              <StarRating stars={event.stars} />
            )}
            {event.kind === 'challenge' && event.grounds && (
              <span className="text-[10px] font-mono text-against-400 border border-against-500/30 rounded px-1.5 py-0.5">
                {grounds[event.grounds] ?? event.grounds}
              </span>
            )}
            {event.kind === 'amendment' && event.status && (
              <span className={cn(
                'text-[10px] font-mono border rounded px-1.5 py-0.5',
                event.status === 'ratified' ? 'text-emerald border-emerald/30' :
                event.status === 'rejected' ? 'text-against-400 border-against-500/30' :
                'text-purple border-purple/30'
              )}>
                {amendmentStatus[event.status] ?? event.status}
              </span>
            )}
            <span className="text-[10px] text-surface-600 font-mono ml-auto">{relTime(event.created_at)}</span>
          </div>

          {/* Actor */}
          {event.actor && (
            <Link
              href={`/profile/${event.actor.username}`}
              className="flex items-center gap-1.5 mt-1 group w-fit"
            >
              <Avatar
                src={event.actor.avatar_url}
                fallback={event.actor.display_name || event.actor.username}
                size="xs"
              />
              <span className="text-xs text-surface-400 group-hover:text-white transition-colors truncate">
                {event.actor.display_name || `@${event.actor.username}`}
              </span>
            </Link>
          )}
        </div>
      </div>

      {/* Body */}
      {event.body && (
        <div className={cn(
          'ml-9 text-sm leading-relaxed font-mono',
          event.kind === 'chat' ? 'text-for-200' :
          event.kind === 'review' ? 'text-surface-300 italic' :
          event.kind === 'wiki_edit' ? 'text-emerald/70' :
          event.kind === 'challenge' ? 'text-against-200 font-semibold text-xs' :
          'text-purple/80 text-xs font-semibold'
        )}>
          {event.kind === 'review' && event.body && <>&ldquo;{event.body}&rdquo;</>}
          {event.kind !== 'review' && event.body}
        </div>
      )}
    </motion.article>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-surface-300/30 bg-surface-200/30 p-3.5 space-y-2.5">
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-2.5 w-20 rounded" />
          <Skeleton className="h-3 w-32 rounded" />
        </div>
      </div>
      <Skeleton className="h-8 w-full ml-9 rounded" />
    </div>
  )
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Activity
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-surface-200/60 border border-surface-300/40 px-3 py-2">
      <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', color)} aria-hidden="true" />
      <div className="min-w-0">
        <p className={cn('text-sm font-bold', color)}>{value}</p>
        <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">{label}</p>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  lawId: string
  lawStatement: string
}

export function LawPulseClient({ lawId, lawStatement }: Props) {
  const [data, setData] = useState<LawPulseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const prevIdsRef = useRef<Set<string>>(new Set())

  const fetchData = useCallback(async (isPoll = false) => {
    try {
      const res = await fetch(`/api/laws/${lawId}/pulse`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      const next: LawPulseData = await res.json()

      if (isPoll) {
        const freshIds = new Set(next.events.map((e) => e.id).filter((id) => !prevIdsRef.current.has(id)))
        if (freshIds.size > 0) setNewIds(freshIds)
      }
      prevIdsRef.current = new Set(next.events.map((e) => e.id))
      setData(next)
    } catch (err) {
      if (!isPoll) setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      if (!isPoll) setLoading(false)
    }
  }, [lawId])

  useEffect(() => { fetchData(false) }, [fetchData])

  useEffect(() => {
    if (paused) return
    const t = setInterval(() => fetchData(true), POLL_MS)
    return () => clearInterval(t)
  }, [paused, fetchData])

  useEffect(() => {
    if (newIds.size === 0) return
    const t = setTimeout(() => setNewIds(new Set()), 4000)
    return () => clearTimeout(t)
  }, [newIds])

  const engCfg = data ? ENGAGEMENT_CONFIG[data.engagement_label] : null

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />
      <main className="flex-1 pb-20 md:pb-0">
        <div className="max-w-2xl mx-auto px-4 pt-6">

          {/* Page header */}
          <div className="flex items-start gap-3 mb-5">
            <Link
              href={`/law/${lawId}`}
              aria-label="Back to law"
              className="flex-shrink-0 mt-0.5 h-9 w-9 rounded-lg bg-surface-200 flex items-center justify-center text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Activity className="h-4 w-4 text-for-400 flex-shrink-0" aria-hidden="true" />
                <h1 className="text-lg font-bold text-white tracking-tight">Law Pulse</h1>
                {data && (
                  <Badge variant="law" className="flex-shrink-0">ESTABLISHED</Badge>
                )}
              </div>
              <p className="text-xs text-surface-500 font-mono line-clamp-2 leading-relaxed">
                {(data?.law.statement ?? lawStatement).slice(0, 120)}
              </p>
            </div>

            <button
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? 'Resume live updates' : 'Pause live updates'}
              className={cn(
                'flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold border transition-all',
                paused
                  ? 'bg-surface-200 border-surface-400 text-surface-700'
                  : 'bg-for-500/10 border-for-500/30 text-for-400 animate-pulse',
              )}
            >
              {paused ? <><Play className="h-3 w-3" aria-hidden="true" />PAUSED</> : <><Activity className="h-3 w-3" aria-hidden="true" />LIVE</>}
            </button>
          </div>

          {/* Engagement card */}
          {loading ? (
            <div className="rounded-xl border border-surface-300/40 bg-surface-200/60 p-4 mb-5 space-y-2">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="grid grid-cols-4 gap-2 mt-3">
                {[0,1,2,3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
              </div>
            </div>
          ) : data && (
            <div className="rounded-xl border border-surface-300/40 bg-surface-200/50 p-4 mb-5 space-y-3">
              {/* Engagement header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn('h-2 w-2 rounded-full flex-shrink-0', engCfg?.dot)} />
                  <span className={cn('text-sm font-bold', engCfg?.color)}>
                    {engCfg?.label}
                  </span>
                  <span className="text-xs text-surface-500">{engCfg?.desc}</span>
                </div>
                <span className="text-xs font-mono text-surface-500">
                  {data.engagement_score}/100
                </span>
              </div>

              {/* Score bar */}
              <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                <motion.div
                  className={cn(
                    'h-full rounded-full',
                    data.engagement_label === 'thriving' ? 'bg-emerald' :
                    data.engagement_label === 'active'   ? 'bg-for-400' :
                    data.engagement_label === 'quiet'    ? 'bg-gold' :
                    'bg-surface-500'
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${data.engagement_score}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <StatPill
                  icon={Star}
                  label="Avg Rating"
                  value={data.review_avg != null ? `${data.review_avg}★` : '—'}
                  color="text-gold"
                />
                <StatPill
                  icon={MessageSquare}
                  label="Reviews"
                  value={data.review_count}
                  color="text-for-400"
                />
                <StatPill
                  icon={Gavel}
                  label="Open Challenges"
                  value={data.open_challenges}
                  color={data.open_challenges > 0 ? 'text-against-400' : 'text-surface-500'}
                />
                <StatPill
                  icon={Layers}
                  label="Pending Amends"
                  value={data.pending_amendments}
                  color={data.pending_amendments > 0 ? 'text-purple' : 'text-surface-500'}
                />
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {(Object.keys(KIND_CONFIG) as PulseEventKind[]).map((kind) => {
              const cfg = KIND_CONFIG[kind]
              const Icon = cfg.icon
              return (
                <span key={kind} className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border',
                  cfg.bgColor, cfg.borderColor, cfg.iconColor,
                )}>
                  <Icon className="h-2.5 w-2.5" aria-hidden="true" />
                  {cfg.label}
                </span>
              )
            })}
            <button
              onClick={() => { setLoading(true); fetchData(false) }}
              aria-label="Refresh pulse"
              className="ml-auto p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {/* Event feed */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : error ? (
            <div className="py-16 text-center text-sm font-mono text-surface-500">{error}</div>
          ) : !data || data.events.length === 0 ? (
            <EmptyState
              icon={Flame}
              title="No activity yet"
              description="Be the first to review, discuss, or challenge this law."
              actions={[
                { label: 'Leave a review', href: `/law/${lawId}/reviews` },
                { label: 'Join the discussion', href: `/law/${lawId}/discuss` },
                { label: 'File a challenge', href: `/law/${lawId}/challenge` },
              ]}
            />
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {newIds.size > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center justify-center gap-2 py-2 text-xs font-mono text-for-400"
                  >
                    <Activity className="h-3 w-3 animate-spin" aria-hidden="true" />
                    {newIds.size} new event{newIds.size !== 1 ? 's' : ''}
                  </motion.div>
                )}
              </AnimatePresence>
              {data.events.map((event) => (
                <EventCard key={event.id} event={event} isNew={newIds.has(event.id)} />
              ))}
            </div>
          )}

          {/* Footer */}
          {!loading && !error && (
            <div className="mt-8 mb-4 flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-surface-500">
              <Link href={`/law/${lawId}`} className="hover:text-white transition-colors">← Back to law</Link>
              <Link href={`/law/${lawId}/reviews`} className="hover:text-white transition-colors flex items-center gap-1">
                <Star className="h-3 w-3" aria-hidden="true" />Reviews
              </Link>
              <Link href={`/law/${lawId}/discuss`} className="hover:text-white transition-colors flex items-center gap-1">
                <MessageSquare className="h-3 w-3" aria-hidden="true" />Discussion
              </Link>
              <Link href={`/law/${lawId}/challenge`} className="hover:text-white transition-colors flex items-center gap-1">
                <Gavel className="h-3 w-3" aria-hidden="true" />Challenge
              </Link>
              <Link href={`/law/${lawId}/amendments`} className="hover:text-white transition-colors flex items-center gap-1">
                <Layers className="h-3 w-3" aria-hidden="true" />Amendments
              </Link>
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
