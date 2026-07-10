'use client'

/**
 * /relays/pulse — Live Relay Activity Feed
 *
 * Shows the most recent relay leg contributions across the platform,
 * refreshing automatically and allowing side/category filtering.
 *
 * Distinct from:
 *   /relays              — browse all relay chains
 *   /relays/top-legs     — top-upvoted legs of all time
 *   /relays/digest       — weekly stats digest
 *   /relays/for-you      — personalised relay recommendations
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ChevronRight,
  Cpu,
  ExternalLink,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Music2,
  RefreshCw,
  Scale,
  ThumbsUp,
  TrendingUp,
  BookOpen,
  Users,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { PulseLeg, PulseStats, PulseResponse } from '@/app/api/relays/pulse/route'

// ─── Config ───────────────────────────────────────────────────────────────────

const SIDES = ['all', 'for', 'against'] as const
type Side = typeof SIDES[number]

const CATEGORIES = [
  'All',
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Economics:   TrendingUp,
  Politics:    Landmark,
  Technology:  Cpu,
  Science:     FlaskConical,
  Ethics:      Scale,
  Philosophy:  BookOpen,
  Culture:     Music2,
  Health:      Heart,
  Environment: Leaf,
  Education:   GraduationCap,
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-for-300',
  Philosophy:  'text-purple',
  Culture:     'text-against-300',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-gold',
}

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  person:        { label: 'Citizen',       cls: 'text-surface-500 bg-surface-300/60' },
  debator:       { label: 'Debater',       cls: 'text-purple bg-purple/10' },
  troll_catcher: { label: 'Troll Catcher', cls: 'text-emerald bg-emerald/10' },
  elder:         { label: 'Elder',         cls: 'text-gold bg-gold/10' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (s < 5)  return 'just now'
  if (s < 60) return `${s}s ago`
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function contentSnippet(content: string, maxLen = 140): string {
  const trimmed = content.trim()
  return trimmed.length <= maxLen ? trimmed : trimmed.slice(0, maxLen).trimEnd() + '…'
}

function legOrdinal(n: number): string {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  color: string
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-surface-200/60 border border-surface-300/60">
      <Icon className={cn('h-4 w-4 flex-shrink-0', color)} />
      <div>
        <p className="text-xs font-mono font-bold text-white leading-none">
          {typeof value === 'number' ? (
            <AnimatedNumber value={value} />
          ) : (
            value
          )}
        </p>
        <p className="text-[10px] text-surface-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

// ─── Leg card ─────────────────────────────────────────────────────────────────

function LegCard({ leg, isNew }: { leg: PulseLeg; isNew?: boolean }) {
  const roleBadge = ROLE_BADGE[leg.author_role] ?? ROLE_BADGE.person
  const catColor = CATEGORY_COLOR[leg.topic_category ?? ''] ?? 'text-surface-400'
  const CatIcon = CATEGORY_ICON[leg.topic_category ?? '']

  const isFor = leg.side === 'for'
  const sideClass = isFor
    ? 'border-for-600/40 bg-for-600/5'
    : 'border-against-600/40 bg-against-600/5'
  const sideBadgeClass = isFor
    ? 'bg-for-600/20 text-for-300 border-for-600/30'
    : 'bg-against-600/20 text-against-300 border-against-600/30'
  const sideLabel = isFor ? 'FOR' : 'AGAINST'

  const progress = Math.round((leg.relay_leg_count / leg.relay_max_legs) * 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'relative rounded-2xl border p-4 space-y-3',
        sideClass,
        isNew && 'ring-1 ring-offset-0',
        isNew && (isFor ? 'ring-for-500/40' : 'ring-against-500/40')
      )}
    >
      {/* Live indicator for new items */}
      {isNew && (
        <span className="absolute top-3 right-3 flex h-2 w-2">
          <span className={cn(
            'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
            isFor ? 'bg-for-400' : 'bg-against-400'
          )} />
          <span className={cn(
            'relative inline-flex rounded-full h-2 w-2',
            isFor ? 'bg-for-500' : 'bg-against-500'
          )} />
        </span>
      )}

      {/* Header row */}
      <div className="flex items-start gap-3">
        <Link href={`/profile/${leg.author_username}`} className="flex-shrink-0">
          <Avatar
            src={leg.author_avatar_url}
            fallback={leg.author_display_name || leg.author_username}
            size="sm"
          />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/profile/${leg.author_username}`}
              className="text-sm font-semibold text-white hover:text-for-200 transition-colors truncate"
            >
              {leg.author_display_name || leg.author_username}
            </Link>
            <span className={cn(
              'flex-shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded-md',
              roleBadge.cls
            )}>
              {roleBadge.label}
            </span>
          </div>
          <p className="text-xs text-surface-500 mt-0.5">
            contributed the {legOrdinal(leg.leg_number)} leg · {relativeTime(leg.created_at)}
          </p>
        </div>

        {/* Side badge */}
        <span className={cn(
          'flex-shrink-0 text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg border',
          sideBadgeClass
        )}>
          {sideLabel}
        </span>
      </div>

      {/* Topic context */}
      {leg.topic_statement && (
        <div className="flex items-center gap-1.5">
          {CatIcon && <CatIcon className={cn('h-3 w-3 flex-shrink-0', catColor)} />}
          <Link
            href={`/topic/${leg.topic_id}`}
            className={cn('text-xs font-medium hover:underline truncate', catColor)}
          >
            {leg.topic_statement.length > 70
              ? leg.topic_statement.slice(0, 70) + '…'
              : leg.topic_statement}
          </Link>
        </div>
      )}

      {/* Content snippet */}
      <p className="text-sm text-surface-700 leading-relaxed">
        {contentSnippet(leg.content)}
      </p>

      {/* Footer: progress + upvotes + action */}
      <div className="flex items-center gap-3">
        {/* Relay progress bar */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono text-surface-500">
              {leg.relay_leg_count}/{leg.relay_max_legs} legs
            </span>
            <span className={cn(
              'text-[10px] font-mono',
              leg.relay_status === 'complete' || leg.relay_status === 'voted'
                ? 'text-emerald'
                : leg.relay_status === 'in_progress'
                ? 'text-gold'
                : 'text-surface-500'
            )}>
              {leg.relay_status === 'complete' || leg.relay_status === 'voted'
                ? 'Complete'
                : leg.relay_status === 'in_progress'
                ? 'In progress'
                : 'Open'}
            </span>
          </div>
          <div className="h-1 rounded-full bg-surface-300/60 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                isFor ? 'bg-for-500' : 'bg-against-500'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Upvote count */}
        {leg.upvote_count > 0 && (
          <div className="flex items-center gap-1 text-xs text-surface-500">
            <ThumbsUp className="h-3 w-3" />
            <span className="font-mono">{leg.upvote_count}</span>
          </div>
        )}

        {/* View relay link */}
        <Link
          href={`/relays/${leg.relay_id}`}
          className={cn(
            'flex items-center gap-1 text-xs font-mono font-semibold px-2.5 py-1 rounded-lg border transition-all',
            leg.user_has_leg
              ? 'text-surface-500 border-surface-400/40 bg-surface-200/60'
              : isFor
              ? 'text-for-300 border-for-500/40 bg-for-600/10 hover:bg-for-600/20'
              : 'text-against-300 border-against-500/40 bg-against-600/10 hover:bg-against-600/20'
          )}
        >
          {leg.user_has_leg ? (
            <>View</>
          ) : leg.relay_status === 'open' || leg.relay_status === 'in_progress' ? (
            <>Join <ChevronRight className="h-3 w-3" /></>
          ) : (
            <>View</>
          )}
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LegSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300/40 p-4 space-y-3 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-full bg-surface-300/60 flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 w-32 bg-surface-300/60 rounded" />
          <div className="h-2.5 w-48 bg-surface-300/40 rounded" />
        </div>
        <div className="h-5 w-16 bg-surface-300/40 rounded-lg" />
      </div>
      <div className="h-2.5 w-3/4 bg-surface-300/40 rounded" />
      <div className="space-y-1.5">
        <div className="h-3 w-full bg-surface-300/40 rounded" />
        <div className="h-3 w-5/6 bg-surface-300/40 rounded" />
        <div className="h-3 w-2/3 bg-surface-300/40 rounded" />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-surface-300/40 rounded-full" />
        <div className="h-6 w-14 bg-surface-300/40 rounded-lg" />
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function PulseClient() {
  const [legs, setLegs] = useState<PulseLeg[]>([])
  const [stats, setStats] = useState<PulseStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [newLegIds, setNewLegIds] = useState<Set<string>>(new Set())
  const [side, setSide] = useState<Side>('all')
  const [category, setCategory] = useState('All')
  const channelRef = useRef<RealtimeChannel | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchLegs = useCallback(async (isRefresh = false) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams({ limit: '30', side })
      if (category !== 'All') params.set('category', category)

      const res = await fetch(`/api/relays/pulse?${params}`, { signal: ctrl.signal })
      if (!res.ok) throw new Error('fetch failed')
      const data: PulseResponse = await res.json()

      setLegs(data.legs ?? [])
      setStats(data.stats ?? null)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        // leave stale data on refresh failure
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [side, category])

  // Initial fetch + re-fetch on filter change
  useEffect(() => {
    setLegs([])
    fetchLegs(false)
  }, [fetchLegs])

  // Supabase realtime subscription — new relay legs arrive live
  useEffect(() => {
    const supabase = createClient()

    channelRef.current?.unsubscribe()

    const channel = supabase
      .channel('relay-pulse-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'relay_legs' },
        () => {
          // Silently re-fetch to get the enriched row (with profile/topic joins)
          fetchLegs(true)
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
    }
  }, [fetchLegs])

  // Mark newly arrived legs for 6 s
  useEffect(() => {
    if (legs.length === 0) return

    const freshIds = new Set<string>()
    const now = Date.now()
    for (const leg of legs) {
      if (now - new Date(leg.created_at).getTime() < 120_000) {
        freshIds.add(leg.leg_id)
      }
    }

    setNewLegIds(freshIds)

    if (freshIds.size === 0) return
    const timer = setTimeout(() => setNewLegIds(new Set()), 6_000)
    return () => clearTimeout(timer)
  }, [legs])

  const catValue = category === 'All' ? 'All' : category

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-10">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/relays"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to Relays"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple" />
              <h1 className="text-lg font-bold text-white">Relay Pulse</h1>
              {/* live dot */}
              <span className="flex h-2 w-2 ml-0.5">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald" />
              </span>
            </div>
            <p className="text-xs text-surface-500 mt-0.5">
              Live relay argument contributions
            </p>
          </div>

          <button
            onClick={() => fetchLegs(true)}
            disabled={refreshing}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Stats strip */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5"
          >
            <StatCard
              icon={Zap}
              label="Legs today"
              value={stats.legs_today}
              color="text-gold"
            />
            <StatCard
              icon={Users}
              label="Contributors today"
              value={stats.active_contributors}
              color="text-purple"
            />
            <StatCard
              icon={Activity}
              label="Completed today"
              value={stats.relays_completed_today}
              color="text-emerald"
            />
            <StatCard
              icon={stats.most_active_category ? (CATEGORY_ICON[stats.most_active_category] ?? TrendingUp) : TrendingUp}
              label="Hot category"
              value={stats.most_active_category ?? '—'}
              color={CATEGORY_COLOR[stats.most_active_category ?? ''] ?? 'text-surface-500'}
            />
          </motion.div>
        )}

        {/* Filters */}
        <div className="space-y-3 mb-5">
          {/* Side filter */}
          <div className="flex gap-2">
            {SIDES.map((s) => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={cn(
                  'flex-1 py-1.5 rounded-xl text-xs font-mono font-semibold border transition-all',
                  side === s
                    ? s === 'for'
                      ? 'bg-for-600/20 text-for-300 border-for-500/50'
                      : s === 'against'
                      ? 'bg-against-600/20 text-against-300 border-against-500/50'
                      : 'bg-surface-300 text-white border-surface-400'
                    : 'bg-surface-200/60 text-surface-500 border-surface-300/60 hover:border-surface-400/60'
                )}
              >
                {s === 'all' ? 'All' : s === 'for' ? 'FOR' : 'AGAINST'}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const Icon = cat !== 'All' ? CATEGORY_ICON[cat] : undefined
              const isActive = catValue === cat
              const activeColor = CATEGORY_COLOR[cat]

              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    'flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium border transition-all',
                    isActive
                      ? `${activeColor ?? 'text-white'} bg-surface-300 border-surface-400`
                      : 'text-surface-500 bg-surface-200/60 border-surface-300/40 hover:border-surface-400/40'
                  )}
                >
                  {Icon && <Icon className={cn('h-3 w-3', isActive ? activeColor : '')} />}
                  {cat}
                </button>
              )
            })}
          </div>
        </div>

        {/* Legs feed */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <LegSkeleton key={i} />
            ))}
          </div>
        ) : legs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Activity className="h-10 w-10 text-surface-500 mb-4" />
            <p className="text-white font-semibold mb-1">No activity yet</p>
            <p className="text-sm text-surface-500 mb-6">
              {side !== 'all' || catValue !== 'All'
                ? 'Try a different filter to see relay contributions.'
                : 'Be the first to contribute a relay leg.'}
            </p>
            <Link
              href="/relays"
              className="flex items-center gap-1.5 text-sm font-mono font-semibold text-purple hover:text-purple/80 transition-colors"
            >
              Browse relays <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {legs.map((leg) => (
                <LegCard
                  key={leg.leg_id}
                  leg={leg}
                  isNew={newLegIds.has(leg.leg_id)}
                />
              ))}
            </AnimatePresence>

            {/* Bottom links */}
            <div className="pt-4 flex items-center justify-center gap-6 text-xs font-mono text-surface-500">
              <Link href="/relays/top-legs" className="hover:text-white transition-colors flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" /> Top Legs
              </Link>
              <Link href="/relays/digest" className="hover:text-white transition-colors flex items-center gap-1">
                <Activity className="h-3 w-3" /> Weekly Digest
              </Link>
              <Link href="/relays/for-you" className="hover:text-white transition-colors flex items-center gap-1">
                <Zap className="h-3 w-3" /> For You
              </Link>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
