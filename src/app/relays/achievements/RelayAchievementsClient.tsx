'use client'

/**
 * /relays/achievements — Relay Achievement Hall
 *
 * Showcases the 10 relay-specific badges, grouped by tier.
 * Shows earned/unearned state, progress bars, global rarity,
 * and a recent-earners activity strip for social proof.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Lock,
  Radio,
  Trophy,
} from 'lucide-react'
import * as Icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  RelayAchievementsResponse,
  RelayAchievementItem,
  RecentEarner,
} from '@/app/api/relays/achievements/route'
import type { AchievementTier } from '@/lib/supabase/types'

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<
  AchievementTier,
  {
    label: string
    order: number
    border: string
    bg: string
    text: string
    iconBg: string
    pill: string
    bar: string
    glow: string
  }
> = {
  legendary: {
    label: 'Legendary',
    order: 0,
    border: 'border-gold/50',
    bg: 'bg-gold/10',
    text: 'text-gold',
    iconBg: 'bg-gold/15',
    pill: 'bg-gold/15 border-gold/40 text-gold',
    bar: 'bg-gold',
    glow: 'shadow-[0_0_16px_rgba(245,158,11,0.25)]',
  },
  epic: {
    label: 'Epic',
    order: 1,
    border: 'border-purple/50',
    bg: 'bg-purple/10',
    text: 'text-purple',
    iconBg: 'bg-purple/15',
    pill: 'bg-purple/15 border-purple/40 text-purple',
    bar: 'bg-purple',
    glow: 'shadow-[0_0_14px_rgba(139,92,246,0.2)]',
  },
  rare: {
    label: 'Rare',
    order: 2,
    border: 'border-for-500/40',
    bg: 'bg-for-500/8',
    text: 'text-for-400',
    iconBg: 'bg-for-500/15',
    pill: 'bg-for-500/15 border-for-500/40 text-for-400',
    bar: 'bg-for-500',
    glow: 'shadow-[0_0_12px_rgba(59,130,246,0.18)]',
  },
  common: {
    label: 'Common',
    order: 3,
    border: 'border-surface-400/25',
    bg: 'bg-surface-200/30',
    text: 'text-surface-400',
    iconBg: 'bg-surface-300/40',
    pill: 'bg-surface-300/40 border-surface-400/30 text-surface-400',
    bar: 'bg-surface-400',
    glow: '',
  },
}

const TIER_ORDER: AchievementTier[] = ['legendary', 'epic', 'rare', 'common']

// ─── Icon resolver ────────────────────────────────────────────────────────────

function resolveIcon(name: string): LucideIcon {
  const Icon = (Icons as Record<string, LucideIcon>)[name]
  return Icon ?? Radio
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function metricLabel(type: string, threshold: number): string {
  switch (type) {
    case 'relays_started':        return threshold === 1 ? 'Start 1 relay chain' : `Start ${threshold} relay chains`
    case 'relay_legs_added':      return threshold === 1 ? 'Add 1 relay leg' : `Add legs to ${threshold} different relays`
    case 'relays_completed':      return 'Start a relay that reaches full completion'
    case 'relay_compelling_votes':return threshold === 1 ? 'Earn 1 compelling vote on your relay' : `Earn compelling votes on ${threshold} relays`
    case 'relay_leg_stars':       return `Earn ${threshold}+ stars on a single relay leg`
    default:                       return `Reach ${threshold}`
  }
}

// ─── Achievement card ─────────────────────────────────────────────────────────

function AchievementCard({ item }: { item: RelayAchievementItem }) {
  const t = TIER_CONFIG[item.tier]
  const Icon = resolveIcon(item.icon)
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative rounded-2xl border p-4 flex flex-col gap-3 cursor-pointer select-none',
        'transition-all duration-200 hover:scale-[1.02]',
        t.border,
        t.bg,
        item.earned && t.glow,
        !item.earned && 'opacity-70 hover:opacity-90'
      )}
      onClick={() => setExpanded((v) => !v)}
    >
      {/* Earned checkmark */}
      {item.earned && (
        <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-emerald/20 border border-emerald/40 flex items-center justify-center">
          <Check className="h-3 w-3 text-emerald" />
        </div>
      )}

      {/* Lock overlay for unearned */}
      {!item.earned && item.pct === 0 && (
        <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-surface-300/50 border border-surface-400/30 flex items-center justify-center">
          <Lock className="h-3 w-3 text-surface-500" />
        </div>
      )}

      {/* Icon */}
      <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', t.iconBg)}>
        <Icon className={cn('h-5 w-5', t.text)} />
      </div>

      {/* Title + tier */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <p className={cn('text-sm font-semibold leading-tight', item.earned ? 'text-white' : 'text-surface-300')}>
            {item.name}
          </p>
          <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border', t.pill)}>
            {t.label}
          </span>
        </div>
        <p className="text-[11px] text-surface-500 mt-0.5 leading-snug">{item.description}</p>
      </div>

      {/* Progress bar (only for in-progress) */}
      {!item.earned && item.pct > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-surface-500">Progress</span>
            <span className={cn('text-[10px] font-mono font-semibold', t.text)}>{item.pct}%</span>
          </div>
          <div className="h-1 bg-surface-300/40 rounded-full overflow-hidden">
            <motion.div
              className={cn('h-full rounded-full', t.bar)}
              initial={{ width: 0 }}
              animate={{ width: `${item.pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
            />
          </div>
          <p className="text-[10px] text-surface-500 mt-1">
            {item.current} / {item.threshold} — {item.remaining} to go
          </p>
        </div>
      )}

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-2 border-t border-surface-300/30 space-y-1.5">
              <p className="text-[11px] text-surface-400">
                <span className="font-semibold text-surface-300">How to earn: </span>
                {metricLabel(item.criteriaType, item.threshold)}
              </p>
              <p className="text-[11px] text-surface-500">
                {item.earnerCount === 0
                  ? 'No one has earned this yet — be the first!'
                  : `${item.earnerCount.toLocaleString()} citizen${item.earnerCount === 1 ? '' : 's'} earned this`}
              </p>
              {item.earned && item.earnedAt && (
                <p className="text-[11px] text-emerald/80">
                  Earned {relativeTime(item.earnedAt)}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Recent earner row ────────────────────────────────────────────────────────

function RecentEarnerRow({ earner }: { earner: RecentEarner }) {
  const t = TIER_CONFIG[earner.achievementTier]
  const Icon = resolveIcon(earner.achievementIcon)
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-surface-200/30 last:border-0">
      <Link href={`/profile/${earner.username}`} className="flex-shrink-0">
        <Avatar src={earner.avatarUrl} fallback={earner.displayName || earner.username} size="sm" />
      </Link>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white leading-tight">
          <Link href={`/profile/${earner.username}`} className="font-semibold hover:underline">
            {earner.displayName || earner.username}
          </Link>
          {' '}earned{' '}
          <span className={cn('font-semibold', t.text)}>{earner.achievementName}</span>
        </p>
        <p className="text-[10px] text-surface-500">{relativeTime(earner.earnedAt)}</p>
      </div>
      <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0', t.iconBg)}>
        <Icon className={cn('h-3.5 w-3.5', t.text)} />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RelayAchievementsClient() {
  const [data, setData] = useState<RelayAchievementsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | AchievementTier | 'earned' | 'unearned'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/relays/achievements', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load achievements')
      const json: RelayAchievementsResponse = await res.json()
      setData(json)
    } catch {
      setError('Could not load relay achievements.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = data
    ? data.achievements.filter((a) => {
        if (filter === 'all') return true
        if (filter === 'earned') return a.earned
        if (filter === 'unearned') return !a.earned
        return a.tier === filter
      })
    : []

  const earned = data?.earnedCount ?? 0
  const total = data?.totalCount ?? 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ── */}
        <div className="flex items-start gap-3 mb-6">
          <Link
            href="/relays"
            className="mt-0.5 h-8 w-8 rounded-lg bg-surface-200/60 border border-surface-300/50 flex items-center justify-center hover:bg-surface-200 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-surface-400" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-white">Relay Achievements</h1>
              <div className="h-6 w-6 rounded-lg bg-gold/15 border border-gold/30 flex items-center justify-center">
                <Trophy className="h-3.5 w-3.5 text-gold" />
              </div>
            </div>
            <p className="text-sm text-surface-400 mt-0.5">
              10 badges for building civic relay chains — from first link to Grand Relay status
            </p>
          </div>
        </div>

        {/* ── Progress banner (if logged in and has data) ── */}
        {data && total > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-gold/25 bg-gold/5 p-4 mb-6 flex items-center gap-4"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">
                {earned === 0
                  ? 'Start your relay journey'
                  : earned === total
                  ? 'All relay achievements unlocked!'
                  : `${earned} of ${total} relay badges earned`}
              </p>
              <p className="text-xs text-surface-500 mt-0.5">
                {earned === total
                  ? 'You\'ve mastered every relay achievement on the platform.'
                  : `${total - earned} remaining — keep building those chains`}
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              <span className="text-2xl font-bold text-gold">{earned}</span>
              <span className="text-sm text-surface-500">/{total}</span>
            </div>
          </motion.div>
        )}

        {/* ── Filter tabs ── */}
        <div className="flex gap-1.5 flex-wrap mb-5">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'legendary', label: 'Legendary' },
              { id: 'epic', label: 'Epic' },
              { id: 'rare', label: 'Rare' },
              { id: 'common', label: 'Common' },
              { id: 'earned', label: 'Earned' },
              { id: 'unearned', label: 'Locked' },
            ] as { id: typeof filter; label: string }[]
          ).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                filter === id
                  ? 'bg-for-500/20 border-for-500/50 text-for-300'
                  : 'bg-surface-200/40 border-surface-300/40 text-surface-400 hover:border-surface-400/50'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Achievement grid ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load achievements"
            description={error}
            action={{ label: 'Try again', onClick: load }}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No achievements here"
            description={
              filter === 'earned'
                ? "You haven't earned any relay achievements yet. Start a relay chain to begin."
                : 'No achievements match this filter.'
            }
            action={
              filter !== 'all'
                ? { label: 'Show all', onClick: () => setFilter('all') }
                : { label: 'Start a relay', href: '/relays/create' }
            }
          />
        ) : (
          <>
            {/* Group by tier when showing all */}
            {filter === 'all' ? (
              TIER_ORDER.map((tier) => {
                const items = filtered.filter((a) => a.tier === tier)
                if (items.length === 0) return null
                const tc = TIER_CONFIG[tier]
                return (
                  <div key={tier} className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={cn('text-xs font-mono font-bold uppercase tracking-wider', tc.text)}>
                        {tc.label}
                      </span>
                      <div className="flex-1 h-px bg-surface-300/20" />
                      <span className="text-xs text-surface-500">
                        {items.filter((i) => i.earned).length}/{items.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {items.map((item) => (
                        <AchievementCard key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filtered.map((item) => (
                  <AchievementCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Recent earners ── */}
        {data && data.recentEarners.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-white">Recently Earned</h2>
              <div className="flex-1 h-px bg-surface-300/20" />
            </div>
            <div className="rounded-2xl border border-surface-200/40 bg-surface-100/40 px-4 divide-y divide-surface-200/30">
              {data.recentEarners.map((earner, i) => (
                <RecentEarnerRow key={`${earner.userId}-${earner.earnedAt}-${i}`} earner={earner} />
              ))}
            </div>
          </div>
        )}

        {/* ── Nav links ── */}
        <div className="mt-8 grid grid-cols-2 gap-3">
          <Link
            href="/relays"
            className="flex items-center gap-2 p-3 rounded-xl bg-surface-100/40 border border-surface-200/40 hover:border-surface-300/60 transition-colors group"
          >
            <Radio className="h-4 w-4 text-surface-400 group-hover:text-white transition-colors" />
            <div>
              <p className="text-xs font-semibold text-surface-300 group-hover:text-white transition-colors">Browse Relays</p>
              <p className="text-[10px] text-surface-500">Explore active chains</p>
            </div>
          </Link>
          <Link
            href="/relays/create"
            className="flex items-center gap-2 p-3 rounded-xl bg-for-500/10 border border-for-500/30 hover:border-for-500/50 transition-colors group"
          >
            <ArrowRight className="h-4 w-4 text-for-400 group-hover:text-for-300 transition-colors" />
            <div>
              <p className="text-xs font-semibold text-for-400 group-hover:text-for-300 transition-colors">Start a Relay</p>
              <p className="text-[10px] text-surface-500">Begin earning badges</p>
            </div>
          </Link>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
