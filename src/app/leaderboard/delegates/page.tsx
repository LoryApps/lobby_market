'use client'

/**
 * /leaderboard/delegates — Trusted Delegate Rankings
 *
 * Ranks citizens by how many fellow citizens trust them with delegated votes.
 * Complements the /delegate page where users can set up their own delegations.
 *
 * Tabs:
 *   Most Trusted  — total delegations received (global + category + topic)
 *   Global Sages  — citizens trusted to vote on everything
 *   Category Pros — citizens trusted in specific policy categories
 *
 * Tiers:
 *   Oracle  (≥50) — extraordinary community trust
 *   Sage    (≥20) — widely trusted voice
 *   Elder   (≥10) — respected civic leader
 *   Mentor  (≥5)  — building a trust network
 *   Trusted (<5)  — beginning to earn community trust
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Crown,
  Globe,
  Info,
  Layers,
  RefreshCw,
  Shield,
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
  DelegateLeaderEntry,
  DelegateTier,
  DelegateLeaderboardResponse,
} from '@/app/api/leaderboard/delegates/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<
  DelegateTier,
  { label: string; color: string; bg: string; border: string; icon: typeof Trophy }
> = {
  oracle:  { label: 'Oracle',  color: 'text-gold',       bg: 'bg-gold/10',      border: 'border-gold/30',      icon: Crown   },
  sage:    { label: 'Sage',    color: 'text-purple',     bg: 'bg-purple/10',    border: 'border-purple/25',    icon: Sparkles },
  elder:   { label: 'Elder',   color: 'text-for-400',    bg: 'bg-for-500/10',   border: 'border-for-500/25',   icon: Shield  },
  mentor:  { label: 'Mentor',  color: 'text-emerald',    bg: 'bg-emerald/10',   border: 'border-emerald/25',   icon: Users   },
  trusted: { label: 'Trusted', color: 'text-surface-400', bg: 'bg-surface-300/30', border: 'border-surface-300/40', icon: Zap },
}

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debater',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
}

type Tab = 'total' | 'global' | 'category'

const TABS: { id: Tab; label: string; icon: typeof Globe; description: string }[] = [
  { id: 'total',    label: 'Most Trusted',   icon: Trophy, description: 'Citizens with the most delegations overall' },
  { id: 'global',   label: 'Global Sages',   icon: Globe,  description: 'Trusted to vote on any topic' },
  { id: 'category', label: 'Category Pros',  icon: Layers, description: 'Specialists in specific policy areas' },
]

const CATEGORY_COLORS: Record<string, string> = {
  Politics: 'text-for-400',
  Economics: 'text-gold',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-indigo-400',
  Culture: 'text-orange-400',
  Health: 'text-pink-400',
  Environment: 'text-green-400',
  Education: 'text-cyan-400',
}

// ─── Rank medal ───────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gold/15 border border-gold/30 text-gold font-mono font-bold text-sm flex-shrink-0">
      1
    </div>
  )
  if (rank === 2) return (
    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-surface-300/40 border border-surface-300/50 text-surface-300 font-mono font-bold text-sm flex-shrink-0">
      2
    </div>
  )
  if (rank === 3) return (
    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-amber-800/20 border border-amber-700/30 text-amber-600 font-mono font-bold text-sm flex-shrink-0">
      3
    </div>
  )
  return (
    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-surface-200/40 font-mono text-surface-600 text-xs font-semibold flex-shrink-0">
      {rank}
    </div>
  )
}

// ─── Delegate entry card ──────────────────────────────────────────────────────

function DelegateCard({
  entry,
  tab,
  isMe,
}: {
  entry: DelegateLeaderEntry
  tab: Tab
  isMe: boolean
}) {
  const tier = TIER_CONFIG[entry.tier]
  const TierIcon = tier.icon

  const primaryCount =
    tab === 'global'
      ? entry.global_count
      : tab === 'category'
        ? entry.category_count
        : entry.total_count

  const primaryLabel =
    tab === 'global' ? 'global' : tab === 'category' ? 'category' : 'total'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border transition-colors',
        isMe
          ? 'bg-for-500/8 border-for-500/30 ring-1 ring-for-500/20'
          : 'bg-surface-100 border-surface-200 hover:border-surface-300',
      )}
    >
      {/* Rank */}
      <RankBadge rank={entry.rank} />

      {/* Avatar */}
      <Link href={`/profile/${entry.username}`} className="flex-shrink-0">
        <Avatar
          src={entry.avatar_url}
          fallback={entry.display_name ?? entry.username}
          size="sm"
        />
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/profile/${entry.username}`}
            className="text-sm font-mono font-semibold text-white hover:text-for-400 transition-colors truncate"
          >
            {entry.display_name ?? `@${entry.username}`}
          </Link>
          {isMe && (
            <span className="text-[10px] font-mono text-for-400 bg-for-500/10 border border-for-500/20 rounded px-1 py-0.5">
              You
            </span>
          )}
          <span className={cn('text-[10px] font-mono flex items-center gap-0.5', tier.color)}>
            <TierIcon className="h-2.5 w-2.5" />
            {tier.label}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {/* Role */}
          <span className="text-[10px] font-mono text-surface-600">
            {ROLE_LABEL[entry.role] ?? entry.role}
          </span>
          {/* Category badges */}
          {entry.top_categories.length > 0 && (
            <>
              <span className="text-[10px] text-surface-700">·</span>
              {entry.top_categories.map((cat) => (
                <span
                  key={cat}
                  className={cn(
                    'text-[9px] font-mono px-1 py-0.5 rounded bg-surface-200/60',
                    CATEGORY_COLORS[cat] ?? 'text-surface-400',
                  )}
                >
                  {cat}
                </span>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Trust count */}
      <div className="flex-shrink-0 text-right">
        <p className={cn('text-lg font-mono font-bold tabular-nums', tier.color)}>
          <AnimatedNumber value={primaryCount} />
        </p>
        <p className="text-[10px] font-mono text-surface-600">{primaryLabel} trust</p>
        {tab === 'total' && entry.total_count > primaryCount && (
          <p className="text-[9px] font-mono text-surface-700">
            {entry.global_count > 0 && `${entry.global_count}g`}
            {entry.global_count > 0 && entry.category_count > 0 && ' '}
            {entry.category_count > 0 && `${entry.category_count}c`}
            {entry.topic_count > 0 && ` ${entry.topic_count}t`}
          </p>
        )}
      </div>

      <ChevronRight className="h-3.5 w-3.5 text-surface-600 flex-shrink-0" />
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DelegatesLeaderboardPage() {
  const [tab, setTab] = useState<Tab>('total')
  const [data, setData] = useState<DelegateLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [myUserId, setMyUserId] = useState<string | null>(null)

  // Load user id for highlighting
  useEffect(() => {
    import('@/lib/supabase/client')
      .then((m) => m.createClient())
      .then((supabase) => supabase.auth.getUser())
      .then(({ data: { user } }) => setMyUserId(user?.id ?? null))
      .catch(() => {})
  }, [])

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      try {
        const res = await fetch(`/api/leaderboard/delegates?tab=${tab}`)
        if (res.ok) {
          const json = (await res.json()) as DelegateLeaderboardResponse
          setData(json)
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [tab],
  )

  useEffect(() => {
    setData(null)
    load()
  }, [tab, load])

  const activeTab = TABS.find((t) => t.id === tab)!

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-4 pb-28 space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Link
            href="/leaderboard"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors flex-shrink-0 mt-0.5"
            aria-label="Back to leaderboard"
          >
            <ArrowLeft className="h-4 w-4 text-surface-400" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-mono font-bold text-white flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald" />
              Delegate Leaderboard
            </h1>
            <p className="text-xs text-surface-500 font-mono">Most trusted civic voices</p>
          </div>
          <button
            onClick={() => setInfoOpen((v) => !v)}
            aria-label="How delegation trust works"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors flex-shrink-0"
          >
            <Info className="h-4 w-4 text-surface-400" />
          </button>
        </div>

        {/* Info panel */}
        <AnimatePresence>
          {infoOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 rounded-2xl bg-emerald/5 border border-emerald/20 space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald flex-shrink-0" />
                  <p className="text-xs font-mono font-semibold text-emerald">How Trust Is Measured</p>
                </div>
                <ul className="space-y-1.5 text-[11px] font-mono text-surface-500 leading-relaxed">
                  <li>• Citizens can delegate their vote to trusted people on <span className="text-white">specific topics</span>, a <span className="text-for-400">category</span>, or <span className="text-gold">globally</span>.</li>
                  <li>• This leaderboard ranks citizens by how many others trust them with delegated votes.</li>
                  <li>• <span className="text-gold">Global</span> delegates are trusted across all topics. <span className="text-for-400">Category</span> pros are specialists.</li>
                  <li>• Your own explicit vote always takes precedence over any delegation.</li>
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Platform stats */}
        {data && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 gap-3"
          >
            <div className="p-3 rounded-xl bg-surface-100 border border-surface-200 text-center">
              <p className="text-xl font-mono font-bold text-emerald tabular-nums">
                <AnimatedNumber value={data.total_delegates} />
              </p>
              <p className="text-[10px] font-mono text-surface-600 mt-0.5">Trusted Delegates</p>
            </div>
            <div className="p-3 rounded-xl bg-surface-100 border border-surface-200 text-center">
              <p className="text-xl font-mono font-bold text-gold tabular-nums">
                <AnimatedNumber value={data.total_delegations} />
              </p>
              <p className="text-[10px] font-mono text-surface-600 mt-0.5">Active Delegations</p>
            </div>
          </motion.div>
        )}

        {/* My stats bar (if trusted by others) */}
        {data?.my_stats && data.my_stats.total_count > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl bg-for-500/8 border border-for-500/25 flex items-center gap-3"
          >
            <div className="flex-1">
              <p className="text-xs font-mono font-semibold text-white flex items-center gap-1.5">
                <Users className="h-3 w-3 text-for-400" />
                Your Trust Score
              </p>
              <p className="text-[11px] font-mono text-surface-500 mt-0.5">
                {data.my_stats.total_count} citizen{data.my_stats.total_count !== 1 ? 's' : ''} trust you
                {data.my_stats.rank && (
                  <span className="text-for-400"> · Rank #{data.my_stats.rank}</span>
                )}
              </p>
            </div>
            <div className="text-right">
              {data.my_stats.global_count > 0 && (
                <p className="text-[10px] font-mono text-gold">{data.my_stats.global_count} global</p>
              )}
              {data.my_stats.category_count > 0 && (
                <p className="text-[10px] font-mono text-for-400">{data.my_stats.category_count} category</p>
              )}
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-surface-100 border border-surface-200 rounded-xl">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-mono font-semibold transition-all',
                  tab === t.id
                    ? 'bg-surface-300 text-white shadow-sm'
                    : 'text-surface-500 hover:text-surface-300',
                )}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.label.split(' ')[0]}</span>
              </button>
            )
          })}
        </div>

        {/* Tab description */}
        <p className="text-[11px] font-mono text-surface-600 -mt-2">{activeTab.description}</p>

        {/* Refresh */}
        <div className="flex items-center justify-between -mt-1">
          <span />
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-[11px] font-mono text-surface-600 hover:text-surface-400 transition-colors disabled:opacity-50"
            aria-label="Refresh leaderboard"
          >
            <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Leaderboard */}
        {loading ? (
          <LoadingSkeleton />
        ) : data?.entries.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="No delegates yet"
            description="Be the first to delegate your vote and help build a trusted civic network."
            action={
              <Link
                href="/delegate"
                className="inline-flex items-center gap-2 px-4 py-2 bg-for-600 hover:bg-for-500 text-white rounded-lg text-sm font-mono font-semibold transition-colors"
              >
                <Zap className="h-3.5 w-3.5" />
                Set Up Delegations
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {(data?.entries ?? []).map((entry) => (
                <DelegateCard
                  key={entry.user_id}
                  entry={entry}
                  tab={tab}
                  isMe={myUserId === entry.user_id}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* CTA footer */}
        <div className="pt-4 space-y-3">
          <Link
            href="/delegate"
            className="flex items-center justify-between w-full p-4 rounded-xl bg-surface-100 border border-surface-200 hover:border-for-500/40 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-for-500/10 border border-for-500/20 flex items-center justify-center flex-shrink-0">
                <Zap className="h-4 w-4 text-for-400" />
              </div>
              <div>
                <p className="text-sm font-mono font-semibold text-white group-hover:text-for-400 transition-colors">
                  Manage Your Delegations
                </p>
                <p className="text-[11px] font-mono text-surface-600">
                  Delegate your vote to citizens you trust
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-surface-600 group-hover:text-for-400 transition-colors" />
          </Link>

          <Link
            href="/leaderboard"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-surface-200 hover:border-surface-300 transition-colors text-xs font-mono text-surface-500 hover:text-surface-300"
          >
            <Trophy className="h-3.5 w-3.5" />
            View All Leaderboards
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
