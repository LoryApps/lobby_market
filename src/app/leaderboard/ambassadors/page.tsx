'use client'

/**
 * /leaderboard/ambassadors — The Civic Ambassador Rankings
 *
 * A public leaderboard of the platform's most successful civic recruiters.
 * Rankings are derived from the referral_codes table (public read) and
 * referral_conversions (who signed up AND cast their first vote).
 *
 * Three views:
 *   By Conversions — most new citizens who actually voted (the gold standard)
 *   By Signups     — most new sign-ups regardless of activation
 *   By Clout Earned — most Clout earned via referrals
 *
 * Distinct from:
 *   /ambassador        — your personal referral dashboard (private)
 *   /leaderboard       — general platform leaderboard
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  Coins,
  Crown,
  Globe,
  Medal,
  RefreshCw,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  AmbassadorEntry,
  AmbassadorLeaderboardResponse,
} from '@/app/api/leaderboard/ambassadors/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-4 w-4 text-gold flex-shrink-0" />
  if (rank === 2) return <Medal className="h-4 w-4 text-surface-300 flex-shrink-0" />
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-600 flex-shrink-0" />
  return (
    <span className="text-xs font-mono text-surface-500 w-4 text-center flex-shrink-0">
      {rank}
    </span>
  )
}

// ─── Ambassador tier badge ────────────────────────────────────────────────────

function getTier(converted: number): {
  label: string
  bg: string
  text: string
  border: string
} {
  if (converted >= 50) return { label: 'Champion', bg: 'bg-gold/15', text: 'text-gold', border: 'border-gold/30' }
  if (converted >= 20) return { label: 'Movement Maker', bg: 'bg-emerald/15', text: 'text-emerald', border: 'border-emerald/30' }
  if (converted >= 10) return { label: 'Builder', bg: 'bg-for-500/15', text: 'text-for-300', border: 'border-for-500/30' }
  if (converted >= 5) return { label: 'Recruiter', bg: 'bg-purple/15', text: 'text-purple', border: 'border-purple/30' }
  if (converted >= 1) return { label: 'Ambassador', bg: 'bg-surface-200', text: 'text-surface-400', border: 'border-surface-300' }
  return { label: 'Recruit', bg: 'bg-surface-100', text: 'text-surface-500', border: 'border-surface-300' }
}

function TierBadge({ converted }: { converted: number }) {
  const t = getTier(converted)
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border',
        t.bg, t.text, t.border
      )}
    >
      {t.label}
    </span>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: typeof Users
  value: string | number
  label: string
  color: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-surface-300 bg-surface-100 px-3 py-3">
      <Icon className={cn('h-3.5 w-3.5', color)} />
      <p className="text-sm font-mono font-bold text-white leading-none">
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </p>
      <p className="text-[10px] font-mono text-surface-500 text-center leading-tight">{label}</p>
    </div>
  )
}

// ─── User row ─────────────────────────────────────────────────────────────────

function UserRow({
  entry,
  view,
  index,
}: {
  entry: AmbassadorEntry
  view: View
  index: number
}) {
  const metric =
    view === 'signups'
      ? fmtNum(entry.times_signed_up)
      : view === 'clout'
        ? fmtNum(entry.clout_earned)
        : fmtNum(entry.times_converted)

  const metricLabel =
    view === 'signups'
      ? entry.times_signed_up === 1 ? 'signup' : 'signups'
      : view === 'clout'
        ? 'clout earned'
        : entry.times_converted === 1 ? 'convert' : 'converts'

  const subMetric =
    view === 'signups'
      ? `${fmtNum(entry.times_converted)} converted`
      : view === 'clout'
        ? `${fmtNum(entry.times_converted)} converts · ${fmtNum(entry.times_signed_up)} signups`
        : entry.conversion_rate !== null
          ? `${entry.conversion_rate}% conversion · ${fmtNum(entry.times_signed_up)} signups`
          : `${fmtNum(entry.times_signed_up)} signups`

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.025, duration: 0.2 }}
    >
      <Link
        href={`/profile/${entry.username}`}
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all',
          'bg-surface-100 border-surface-300 hover:border-surface-400 hover:bg-surface-200',
          entry.rank <= 3 && 'border-gold/20 bg-gold/5'
        )}
      >
        {/* Rank */}
        <div className="flex items-center justify-center w-5 flex-shrink-0">
          <RankMedal rank={entry.rank} />
        </div>

        {/* Avatar */}
        <Avatar
          src={entry.avatar_url}
          fallback={entry.display_name ?? entry.username}
          size="sm"
          className="flex-shrink-0"
        />

        {/* Name + sub */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {entry.display_name ?? entry.username}
          </p>
          <p className="text-[11px] text-surface-500 truncate">{subMetric}</p>
        </div>

        {/* Tier */}
        <TierBadge converted={entry.times_converted} />

        {/* Metric */}
        <div className="text-right flex-shrink-0 min-w-[48px]">
          <p className="text-sm font-mono font-bold text-white">{metric}</p>
          <p className="text-[10px] font-mono text-surface-500">{metricLabel}</p>
        </div>

        <ChevronRight className="h-3.5 w-3.5 text-surface-600 flex-shrink-0" />
      </Link>
    </motion.div>
  )
}

// ─── Row skeleton ─────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-surface-300 bg-surface-100">
      <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-2.5 w-40" />
      </div>
      <Skeleton className="h-5 w-16 rounded-md flex-shrink-0" />
      <div className="text-right flex-shrink-0 min-w-[48px] space-y-1">
        <Skeleton className="h-3.5 w-8 ml-auto" />
        <Skeleton className="h-2.5 w-12 ml-auto" />
      </div>
      <Skeleton className="h-3.5 w-3.5 rounded flex-shrink-0" />
    </div>
  )
}

// ─── Tier legend ──────────────────────────────────────────────────────────────

const TIER_LEGEND = [
  { label: 'Champion', converts: '50+', color: 'text-gold' },
  { label: 'Movement Maker', converts: '20–49', color: 'text-emerald' },
  { label: 'Builder', converts: '10–19', color: 'text-for-300' },
  { label: 'Recruiter', converts: '5–9', color: 'text-purple' },
  { label: 'Ambassador', converts: '1–4', color: 'text-surface-400' },
]

// ─── View tabs ────────────────────────────────────────────────────────────────

type View = 'conversions' | 'signups' | 'clout'

const VIEWS: { id: View; label: string; icon: typeof Users; desc: string }[] = [
  {
    id: 'conversions',
    label: 'By Converts',
    icon: Sparkles,
    desc: 'Citizens recruited who signed up AND cast their first vote',
  },
  {
    id: 'signups',
    label: 'By Signups',
    icon: UserPlus,
    desc: 'Total new accounts created via their referral link',
  },
  {
    id: 'clout',
    label: 'By Clout',
    icon: Coins,
    desc: 'Total Clout earned through successful referrals',
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function AmbassadorLeaderboardPage() {
  const [data, setData] = useState<AmbassadorLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [view, setView] = useState<View>('conversions')

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch('/api/leaderboard/ambassadors', { cache: 'no-store' })
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const entries =
    view === 'signups'
      ? data?.topBySignups ?? []
      : view === 'clout'
        ? data?.topByClout ?? []
        : data?.topByConversions ?? []

  const stats = data?.platformStats

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/leaderboard"
            className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg border border-surface-300 bg-surface-100 hover:bg-surface-200 transition-colors"
            aria-label="Back to leaderboard"
          >
            <ArrowLeft className="h-4 w-4 text-surface-400" />
          </Link>

          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-emerald/15 border border-emerald/30 flex-shrink-0">
              <Globe className="h-4 w-4 text-emerald" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-mono font-bold text-white leading-tight">
                Ambassador Rankings
              </h1>
              <p className="text-xs text-surface-500 font-mono truncate">
                Who&rsquo;s growing the Lobby most?
              </p>
            </div>
          </div>

          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh leaderboard"
            className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg border border-surface-300 bg-surface-100 hover:bg-surface-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4 text-surface-400', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* ── Platform stats strip ─────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 px-3 py-3">
                <Skeleton className="h-3.5 w-3.5 mx-auto mb-1.5 rounded" />
                <Skeleton className="h-4 w-10 mx-auto mb-1" />
                <Skeleton className="h-2.5 w-14 mx-auto" />
              </div>
            ))
          ) : (
            <>
              <StatCard
                icon={Users}
                value={stats?.total_ambassadors ?? 0}
                label="Active ambassadors"
                color="text-emerald"
              />
              <StatCard
                icon={UserPlus}
                value={stats?.total_signups ?? 0}
                label="Total signups"
                color="text-for-400"
              />
              <StatCard
                icon={Sparkles}
                value={stats?.total_conversions ?? 0}
                label="Civic converts"
                color="text-gold"
              />
              <StatCard
                icon={Coins}
                value={stats?.total_clout_awarded != null ? fmtNum(stats.total_clout_awarded) : '0'}
                label="Clout awarded"
                color="text-purple"
              />
            </>
          )}
        </div>

        {/* ── Tier legend ──────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 px-4 py-3 mb-6">
          <p className="text-[11px] font-mono text-surface-500 mb-2 uppercase tracking-wide">
            Ambassador tiers (by converts)
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {TIER_LEGEND.map(({ label, converts, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={cn('text-xs font-mono font-bold', color)}>{label}</span>
                <span className="text-[11px] font-mono text-surface-500">{converts}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] font-mono text-surface-600 mt-2">
            Converts = signed up via your link AND cast their first vote
          </p>
        </div>

        {/* ── View tabs ────────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-0.5">
          {VIEWS.map((v) => {
            const Icon = v.icon
            const active = view === v.id
            return (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-medium border transition-all',
                  active
                    ? 'bg-emerald/20 border-emerald/40 text-emerald'
                    : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-surface-300 hover:border-surface-400'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {v.label}
              </button>
            )
          })}
        </div>

        {/* ── View description ─────────────────────────────────────────────── */}
        <p className="text-xs font-mono text-surface-500 mb-4">
          {VIEWS.find((v) => v.id === view)?.desc}
        </p>

        {/* ── List ─────────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => <RowSkeleton key={i} />)}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={Globe}
            iconColor="text-emerald"
            iconBg="bg-emerald/10"
            iconBorder="border-emerald/30"
            title="No ambassadors yet"
            description="Be the first to recruit new citizens — share your referral link from the Ambassador page and earn Clout for every civic convert."
            action={
              <Link
                href="/ambassador"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald/90 text-surface-900 text-sm font-mono font-bold hover:bg-emerald transition-colors"
              >
                <Globe className="h-4 w-4" />
                Get your referral link
              </Link>
            }
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="space-y-2"
            >
              {entries.map((entry, i) => (
                <UserRow key={entry.user_id} entry={entry} view={view} index={i} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        {!loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            className="mt-8 rounded-2xl border border-emerald/20 bg-emerald/5 p-5"
          >
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald/15 border border-emerald/30 flex-shrink-0">
                <Globe className="h-5 w-5 text-emerald" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono font-bold text-white mb-1">
                  Become a Civic Ambassador
                </p>
                <p className="text-xs font-mono text-surface-400 leading-relaxed">
                  Get your personal referral link, track your recruits, and earn +50 Clout for
                  every citizen who joins the Lobby and casts their first vote.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row items-center gap-2">
              <Link
                href="/ambassador"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald/90 hover:bg-emerald text-surface-900 text-sm font-mono font-bold transition-colors"
              >
                <Globe className="h-4 w-4" />
                My ambassador dashboard
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/leaderboard"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 text-surface-300 text-sm font-mono font-medium transition-colors"
              >
                <BarChart2 className="h-4 w-4" />
                All leaderboards
              </Link>
            </div>
          </motion.div>
        )}

        {/* ── Back link ─────────────────────────────────────────────────────── */}
        <div className="mt-6 flex justify-center">
          <Link
            href="/leaderboard"
            className="flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All leaderboards
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
