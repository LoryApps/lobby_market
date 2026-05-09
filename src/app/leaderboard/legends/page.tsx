'use client'

/**
 * /leaderboard/legends — The Civic Hall of Legends
 *
 * Six throne-like cards, each celebrating the all-time record holder
 * in one dimension of civic excellence:
 *
 *   The Sage       — highest reputation score ever
 *   The Titan      — most clout accumulated
 *   The Architect  — most laws authored
 *   The Orator     — most argument upvotes earned
 *   The Stalwart   — longest consecutive voting streak
 *   The Voter      — most total votes ever cast
 *   The Champion   — most debate victories
 *
 * No weekly resets. These records stand until broken.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  Crown,
  ExternalLink,
  Gavel,
  Mic,
  RefreshCw,
  Sparkles,
  Star,
  ThumbsUp,
  Trophy,
  Vote,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { LegendEntry, LegendsResponse } from '@/app/api/leaderboard/legends/route'

// ─── Category visual config ───────────────────────────────────────────────────

const LEGEND_CONFIG: Record<
  string,
  {
    icon: typeof Crown
    gradient: string
    ring: string
    badgeBg: string
    badgeText: string
    statColor: string
    glow: string
  }
> = {
  purple: {
    icon: Crown,
    gradient: 'from-purple/20 to-transparent',
    ring: 'ring-purple/40',
    badgeBg: 'bg-purple/15 border-purple/40',
    badgeText: 'text-purple',
    statColor: 'text-purple',
    glow: 'shadow-purple/20',
  },
  gold: {
    icon: Star,
    gradient: 'from-gold/20 to-transparent',
    ring: 'ring-gold/40',
    badgeBg: 'bg-gold/15 border-gold/40',
    badgeText: 'text-gold',
    statColor: 'text-gold',
    glow: 'shadow-gold/20',
  },
  for: {
    icon: ThumbsUp,
    gradient: 'from-for-500/20 to-transparent',
    ring: 'ring-for-500/40',
    badgeBg: 'bg-for-600/15 border-for-500/40',
    badgeText: 'text-for-400',
    statColor: 'text-for-300',
    glow: 'shadow-for-500/20',
  },
  emerald: {
    icon: CheckCircle2,
    gradient: 'from-emerald/20 to-transparent',
    ring: 'ring-emerald/40',
    badgeBg: 'bg-emerald/15 border-emerald/40',
    badgeText: 'text-emerald',
    statColor: 'text-emerald',
    glow: 'shadow-emerald/20',
  },
  blue: {
    icon: Vote,
    gradient: 'from-for-600/20 to-transparent',
    ring: 'ring-for-600/40',
    badgeBg: 'bg-for-600/15 border-for-600/40',
    badgeText: 'text-for-300',
    statColor: 'text-for-200',
    glow: 'shadow-for-600/20',
  },
  against: {
    icon: Mic,
    gradient: 'from-against-500/20 to-transparent',
    ring: 'ring-against-500/40',
    badgeBg: 'bg-against-500/15 border-against-500/40',
    badgeText: 'text-against-300',
    statColor: 'text-against-300',
    glow: 'shadow-against-500/20',
  },
}

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  elder: { label: 'Elder', color: 'text-gold' },
  troll_catcher: { label: 'Troll Catcher', color: 'text-emerald' },
  debator: { label: 'Debator', color: 'text-for-400' },
  person: { label: 'Member', color: 'text-surface-500' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtStat(val: number | string): string {
  if (typeof val === 'string') return val
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}k`
  return val.toLocaleString()
}

function memberSince(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// ─── Legend Card ──────────────────────────────────────────────────────────────

function LegendCard({ legend, index }: { legend: LegendEntry; index: number }) {
  const cfg = LEGEND_CONFIG[legend.color] ?? LEGEND_CONFIG.gold
  const Icon = cfg.icon
  const role = ROLE_BADGE[legend.profile.role] ?? ROLE_BADGE.person

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07, ease: 'easeOut' }}
    >
      <Link
        href={`/profile/${legend.profile.username}`}
        className={cn(
          'group block relative rounded-2xl border bg-surface-100',
          'border-surface-300 hover:border-surface-400',
          'transition-all duration-200 overflow-hidden',
          'shadow-lg hover:shadow-xl',
          cfg.glow
        )}
      >
        {/* Gradient header band */}
        <div className={cn('absolute inset-x-0 top-0 h-24 bg-gradient-to-b opacity-60', cfg.gradient)} />

        {/* Crown icon */}
        <div className="absolute top-3 right-3 opacity-30 group-hover:opacity-50 transition-opacity">
          <Icon className="h-6 w-6 text-current" />
        </div>

        <div className="relative p-5 space-y-4">
          {/* Title */}
          <div className="space-y-0.5">
            <p className={cn('text-[11px] font-mono uppercase tracking-widest font-semibold', cfg.badgeText)}>
              {legend.title}
            </p>
            <p className="text-[11px] font-mono text-surface-500 leading-relaxed line-clamp-2">
              {legend.description}
            </p>
          </div>

          {/* User info */}
          <div className="flex items-center gap-3">
            <div className={cn('ring-2 rounded-full flex-shrink-0', cfg.ring)}>
              <Avatar
                src={legend.profile.avatar_url}
                fallback={legend.profile.display_name || legend.profile.username}
                size="md"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-mono font-semibold text-white truncate">
                {legend.profile.display_name || legend.profile.username}
              </p>
              <p className="text-[11px] font-mono text-surface-500 truncate">
                @{legend.profile.username}
              </p>
              <p className={cn('text-[10px] font-mono mt-0.5', role.color)}>
                {role.label}
              </p>
            </div>
          </div>

          {/* Stat */}
          <div className={cn(
            'flex items-center justify-between px-3 py-2 rounded-xl border',
            cfg.badgeBg
          )}>
            <span className="text-[11px] font-mono text-surface-500">{legend.stat_label}</span>
            <span className={cn('text-base font-mono font-bold', cfg.statColor)}>
              {fmtStat(legend.stat_value)}
            </span>
          </div>

          {/* Member since */}
          <p className="text-[10px] font-mono text-surface-600">
            Member since {memberSince(legend.profile.created_at)}
          </p>
        </div>

        {/* Hover arrow */}
        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <ExternalLink className="h-3.5 w-3.5 text-surface-500" />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function LegendSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4">
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-9 rounded-xl" />
      <Skeleton className="h-3 w-24" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LegendsPage() {
  const [legends, setLegends] = useState<LegendEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/leaderboard/legends', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const data = (await res.json()) as LegendsResponse
      setLegends(data.legends)
    } catch {
      setError('Could not load the Hall of Legends. Try again in a moment.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Header ── */}
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-3"
            >
              <ArrowLeft className="h-3 w-3" />
              All Leaderboards
            </Link>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gold/15 border border-gold/40 flex items-center justify-center flex-shrink-0">
                <Trophy className="h-4.5 w-4.5 text-gold" />
              </div>
              <div>
                <h1 className="text-xl font-mono font-bold text-white">Hall of Legends</h1>
                <p className="text-xs font-mono text-surface-500 mt-0.5">
                  All-time record holders across every dimension of civic excellence
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-500 hover:text-white hover:bg-surface-200 border border-surface-300 transition-colors disabled:opacity-40"
            aria-label="Refresh legends"
          >
            <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ── Notice ── */}
        <div className="mb-6 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-gold/5 border border-gold/20">
          <Sparkles className="h-3.5 w-3.5 text-gold flex-shrink-0 mt-0.5" />
          <p className="text-[11px] font-mono text-surface-400 leading-relaxed">
            These records are permanent — no weekly resets. Legends are determined by all-time performance
            across the platform. Records stand until a new challenger surpasses them.
          </p>
        </div>

        {/* ── Grid ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <LegendSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={Trophy}
            title="Hall Under Construction"
            description={error}
            actions={[{ label: 'Try again', onClick: () => load() }]}
          />
        ) : legends.length === 0 ? (
          <EmptyState
            icon={Trophy}
            iconColor="text-gold"
            iconBg="bg-gold/10"
            iconBorder="border-gold/30"
            title="No Legends Yet"
            description="The Hall of Legends forms as users engage with the Lobby. Be the first to set a record."
            actions={[{ label: 'Browse Leaderboard', href: '/leaderboard' }]}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {legends.map((legend, i) => (
              <LegendCard key={`${legend.category}-${legend.profile.id}`} legend={legend} index={i} />
            ))}
          </div>
        )}

        {/* ── Footer context ── */}
        {!loading && legends.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-10 pt-6 border-t border-surface-300"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              {[
                { icon: Crown, label: 'Reputation', href: '/leaderboard', color: 'text-purple' },
                { icon: Gavel, label: 'Laws', href: '/leaderboard/laws', color: 'text-gold' },
                { icon: ThumbsUp, label: 'Arguments', href: '/leaderboard/arguments', color: 'text-for-400' },
                { icon: Mic, label: 'Debates', href: '/leaderboard/debates', color: 'text-against-400' },
              ].map(({ icon: Icon, label, href, color }) => (
                <Link
                  key={label}
                  href={href}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
                >
                  <Icon className={cn('h-4 w-4', color)} />
                  <span className="text-[11px] font-mono text-surface-500 group-hover:text-white transition-colors">
                    {label} Leaderboard
                  </span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
