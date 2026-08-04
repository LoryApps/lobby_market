'use client'

/**
 * /leaderboard/endorsements — Top Law Endorsers
 *
 * Citizens ranked by how many established laws they have formally endorsed.
 * Endorsing a law is a live civic commitment: "I stand behind this law today."
 *
 * Distinct from:
 *   /law/endorsements  — laws ordered by endorsement count (endorsee view)
 *   /leaderboard/laws  — citizens by laws they've voted into existence
 *   /leaderboard/clout — citizens by Clout balance
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Crown,
  ExternalLink,
  Gavel,
  HandshakeIcon,
  Heart,
  Loader2,
  RefreshCw,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  EndorserEntry,
  EndorsementLeaderboardResponse,
} from '@/app/api/leaderboard/endorsements/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

function getTier(count: number): {
  label: string
  color: string
  bg: string
  border: string
  badge: string
  icon: typeof Crown
} {
  if (count >= 100)
    return {
      label: 'Champion',
      color: 'text-gold',
      bg: 'bg-gold/10',
      border: 'border-gold/40',
      badge: 'bg-gold/20 text-gold',
      icon: Crown,
    }
  if (count >= 50)
    return {
      label: 'Steward',
      color: 'text-for-300',
      bg: 'bg-for-500/10',
      border: 'border-for-500/40',
      badge: 'bg-for-500/20 text-for-300',
      icon: Award,
    }
  if (count >= 20)
    return {
      label: 'Advocate',
      color: 'text-emerald',
      bg: 'bg-emerald/10',
      border: 'border-emerald/40',
      badge: 'bg-emerald/20 text-emerald',
      icon: Heart,
    }
  if (count >= 5)
    return {
      label: 'Supporter',
      color: 'text-purple',
      bg: 'bg-purple/10',
      border: 'border-purple/40',
      badge: 'bg-purple/20 text-purple',
      icon: Sparkles,
    }
  return {
    label: 'Newcomer',
    color: 'text-surface-500',
    bg: 'bg-surface-300/40',
    border: 'border-surface-400/30',
    badge: 'bg-surface-300/40 text-surface-500',
    icon: Zap,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  person:        { label: 'Citizen',      color: 'text-surface-500' },
  debator:       { label: 'Debater',      color: 'text-for-400' },
  troll_catcher: { label: 'Troll Catcher', color: 'text-emerald' },
  elder:         { label: 'Elder',        color: 'text-gold' },
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2)   return 'just now'
  if (m < 60)  return `${m}m ago`
  if (h < 24)  return `${h}h ago`
  if (d < 30)  return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Medal component ──────────────────────────────────────────────────────────

function Medal({ rank }: { rank: number }) {
  if (rank === 1)
    return <span className="text-lg leading-none select-none" aria-label="1st place">🥇</span>
  if (rank === 2)
    return <span className="text-lg leading-none select-none" aria-label="2nd place">🥈</span>
  if (rank === 3)
    return <span className="text-lg leading-none select-none" aria-label="3rd place">🥉</span>
  return (
    <span className="text-xs font-mono text-surface-500 tabular-nums w-5 text-right">
      {rank}
    </span>
  )
}

// ─── Entry row ────────────────────────────────────────────────────────────────

function EndorserRow({ entry, index }: { entry: EndorserEntry; index: number }) {
  const tier = getTier(entry.endorsement_count)
  const TierIcon = tier.icon
  const roleInfo = ROLE_LABEL[entry.role] ?? { label: 'Citizen', color: 'text-surface-500' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.5) }}
    >
      <Link
        href={`/profile/${entry.username}/endorsements`}
        className={cn(
          'flex items-start gap-3 p-4 rounded-xl border transition-all duration-150',
          'hover:bg-surface-100 hover:border-surface-400 active:scale-[0.99]',
          entry.rank <= 3
            ? `bg-surface-100 ${tier.border}`
            : 'bg-surface-100/40 border-surface-300/50',
        )}
      >
        {/* Rank */}
        <div className="flex-shrink-0 w-6 flex items-center justify-center mt-1">
          <Medal rank={entry.rank} />
        </div>

        {/* Avatar */}
        <Avatar
          src={entry.avatar_url}
          username={entry.username}
          size={38}
          className="flex-shrink-0"
        />

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">
              {entry.display_name ?? entry.username}
            </span>
            <span className={cn('text-xs font-mono', roleInfo.color)}>
              {roleInfo.label}
            </span>
            <span
              className={cn(
                'text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full',
                tier.badge,
              )}
            >
              {tier.label}
            </span>
          </div>

          <div className="text-xs font-mono text-surface-500 mt-0.5">
            @{entry.username}
          </div>

          {/* Sample endorsed laws */}
          {entry.sample_laws.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {entry.sample_laws.slice(0, 2).map((law) => (
                <span
                  key={law.id}
                  className="text-[10px] font-mono text-surface-400 bg-surface-200 border border-surface-300/50 rounded px-1.5 py-0.5 truncate max-w-[180px]"
                  title={law.statement}
                >
                  {law.statement.length > 36
                    ? `${law.statement.slice(0, 36)}…`
                    : law.statement}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Endorsement count */}
        <div className="flex-shrink-0 text-right">
          <div className={cn('text-lg font-mono font-bold tabular-nums', tier.color)}>
            <AnimatedNumber value={entry.endorsement_count} />
          </div>
          <div className="text-[10px] font-mono text-surface-500">
            {entry.endorsement_count === 1 ? 'law' : 'laws'}
          </div>
          {entry.latest_endorsement_at && (
            <div className="text-[10px] font-mono text-surface-600 mt-0.5">
              {relTime(entry.latest_endorsement_at)}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-surface-300/50 bg-surface-100/40">
      <Skeleton className="w-5 h-4" />
      <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="w-32 h-4" />
        <Skeleton className="w-20 h-3" />
      </div>
      <Skeleton className="w-8 h-6" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EndorsementsLeaderboardPage() {
  const [data, setData] = useState<EndorsementLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/leaderboard/endorsements', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-24 pt-4 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/leaderboard"
            className="p-2 rounded-lg bg-surface-100 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <HandshakeIcon className="h-5 w-5 text-gold" />
              Top Law Endorsers
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Citizens ranked by formal law endorsements
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            className="ml-auto p-2 rounded-lg bg-surface-100 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Platform stats */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="stats-skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-3 gap-3"
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </motion.div>
          ) : data ? (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-3 gap-3"
            >
              {[
                {
                  label: 'Total Endorsers',
                  value: data.total_endorsers,
                  icon: Users,
                  color: 'text-for-400',
                },
                {
                  label: 'Total Endorsements',
                  value: data.total_endorsements,
                  icon: Heart,
                  color: 'text-gold',
                },
                {
                  label: 'My Endorsements',
                  value: data.my_stats?.endorsement_count ?? 0,
                  icon: Sparkles,
                  color: 'text-emerald',
                },
              ].map(({ label, value, icon: Icon, color }) => (
                <div
                  key={label}
                  className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center"
                >
                  <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} />
                  <div className={cn('text-xl font-mono font-bold tabular-nums', color)}>
                    <AnimatedNumber value={value} />
                  </div>
                  <div className="text-[10px] font-mono text-surface-500 leading-tight mt-0.5">
                    {label}
                  </div>
                </div>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* My rank card (when logged in and ranked) */}
        <AnimatePresence>
          {!loading && data?.my_stats?.rank && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-for-500/5 border border-for-500/30 p-4 flex items-center gap-3"
            >
              <Trophy className="h-5 w-5 text-gold flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">
                  You are ranked #{data.my_stats.rank}
                </div>
                <div className="text-xs font-mono text-surface-500">
                  Top {100 - (data.my_stats.percentile ?? 100)}% of endorsers
                  · {data.my_stats.endorsement_count} endorsement{data.my_stats.endorsement_count === 1 ? '' : 's'}
                </div>
              </div>
              <Link
                href="/profile/me/endorsements"
                className="flex items-center gap-1 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                View <ArrowRight className="h-3 w-3" />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tier legend */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Champion', threshold: '100+', color: 'text-gold bg-gold/10 border-gold/30' },
            { label: 'Steward', threshold: '50+', color: 'text-for-300 bg-for-500/10 border-for-500/30' },
            { label: 'Advocate', threshold: '20+', color: 'text-emerald bg-emerald/10 border-emerald/30' },
            { label: 'Supporter', threshold: '5+', color: 'text-purple bg-purple/10 border-purple/30' },
          ].map(({ label, threshold, color }) => (
            <span
              key={label}
              className={cn(
                'text-[10px] font-mono px-2 py-0.5 rounded-full border',
                color,
              )}
            >
              {label} · {threshold} laws
            </span>
          ))}
        </div>

        {/* Leaderboard */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="list-skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl bg-against-500/10 border border-against-500/30 p-6 text-center"
            >
              <p className="text-sm font-mono text-against-300 mb-3">{error}</p>
              <button
                onClick={load}
                className="text-xs font-mono text-surface-400 hover:text-white transition-colors"
              >
                Try again
              </button>
            </motion.div>
          ) : data?.entries.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={HandshakeIcon}
                iconColor="text-gold"
                iconBg="bg-gold/10"
                iconBorder="border-gold/30"
                title="No endorsers yet"
                description="Be the first to formally endorse an established law and claim the top spot."
                actions={[{ label: 'Browse Laws', href: '/law' }]}
              />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-2"
            >
              {data?.entries.map((entry, i) => (
                <EndorserRow key={entry.user_id} entry={entry} index={i} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cross-links */}
        {!loading && (data?.entries.length ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 gap-2"
          >
            {[
              { href: '/law/endorsements', label: 'Most Endorsed Laws', icon: Gavel },
              { href: '/law', label: 'Law Codex', icon: ExternalLink },
              { href: '/leaderboard', label: 'All Leaderboards', icon: Trophy },
              { href: '/leaderboard/laws', label: 'Top Lawmakers', icon: Users },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            ))}
          </motion.div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
