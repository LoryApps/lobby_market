'use client'

/**
 * /league — The Lobby League
 *
 * Monthly competitive tier system powered by Clout earned during the season.
 * Six tiers from Bystander → Champion. A fresh race starts on the 1st of
 * every month, so everyone has an equal shot regardless of join date.
 *
 * Distinct from /leaderboard (all-time reputation) and /clout (wallet ledger).
 * This is the sprint: who earned the most this month?
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Calendar,
  ChevronRight,
  Crown,
  Flame,
  RefreshCw,
  Shield,
  Swords,
  Timer,
  Trophy,
  TrendingUp,
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
import type { LeagueResponse, LeagueStanding } from '@/app/api/league/route'

// ─── Tier rank → icon ─────────────────────────────────────────────────────────

const TIER_ICONS: Record<string, React.ElementType> = {
  Bystander: Shield,
  Citizen: Users,
  Delegate: TrendingUp,
  Lawmaker: Swords,
  Senator: Award,
  Champion: Crown,
}

const TIER_BADGE_COLORS: Record<string, string> = {
  Bystander: 'bg-surface-300 text-surface-600',
  Citizen: 'bg-for-600/20 text-for-300 border border-for-600/30',
  Delegate: 'bg-amber-900/30 text-amber-400 border border-amber-700/30',
  Lawmaker: 'bg-gray-700/40 text-gray-300 border border-gray-600/30',
  Senator: 'bg-gold/10 text-gold border border-gold/30',
  Champion: 'bg-purple/10 text-purple border border-purple/30',
}

const TIER_GLOW: Record<string, string> = {
  Bystander: '',
  Citizen: 'shadow-for-600/20',
  Delegate: 'shadow-amber-600/20',
  Lawmaker: 'shadow-gray-500/20',
  Senator: 'shadow-gold/20',
  Champion: 'shadow-purple/20',
}

const TIER_ORDER = ['Bystander', 'Citizen', 'Delegate', 'Lawmaker', 'Senator', 'Champion']
const TIER_THRESHOLDS: Record<string, string> = {
  Bystander: '0 LP',
  Citizen: '50 LP',
  Delegate: '200 LP',
  Lawmaker: '500 LP',
  Senator: '1,000 LP',
  Champion: '2,000 LP',
}

// ─── Role labels ──────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
}

// ─── Rank medal ───────────────────────────────────────────────────────────────

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-gold font-bold text-sm w-6 text-center">#1</span>
  if (rank === 2) return <span className="text-gray-400 font-bold text-sm w-6 text-center">#2</span>
  if (rank === 3) return <span className="text-amber-600 font-bold text-sm w-6 text-center">#3</span>
  return <span className="text-surface-500 text-sm w-6 text-center">#{rank}</span>
}

// ─── Tier progress bar ────────────────────────────────────────────────────────

function TierProgressBar({
  progressPct,
  tierName,
  nextTierName,
  lpToNext,
  tierColor,
}: {
  progressPct: number
  tierName: string
  nextTierName: string | null
  lpToNext: number | null
  tierColor: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-surface-500">
        <span>{tierName}</span>
        {nextTierName ? (
          <span>{nextTierName} in {lpToNext?.toLocaleString()} LP</span>
        ) : (
          <span className="text-gold">Max Tier</span>
        )}
      </div>
      <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: tierColor }}
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <div className="text-right text-xs text-surface-500">{progressPct}%</div>
    </div>
  )
}

// ─── Leaderboard row ──────────────────────────────────────────────────────────

function LeaderboardRow({
  entry,
  isMe,
  delay,
}: {
  entry: LeagueStanding
  isMe: boolean
  delay: number
}) {
  const TierIcon = TIER_ICONS[entry.tier_name] ?? Shield

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay }}
    >
      <Link
        href={`/profile/${entry.username}`}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
          isMe
            ? 'bg-for-600/10 border border-for-600/20'
            : 'hover:bg-surface-200'
        )}
      >
        <RankMedal rank={entry.rank} />

        <Avatar
          src={entry.avatar_url}
          username={entry.username}
          size={32}
          className="flex-shrink-0"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn('text-sm font-medium truncate', isMe ? 'text-for-300' : 'text-white')}>
              {entry.display_name ?? entry.username}
            </span>
            {isMe && (
              <span className="text-xs text-for-400 font-medium">(you)</span>
            )}
          </div>
          <div className="text-xs text-surface-500 truncate">
            {ROLE_LABEL[entry.role] ?? entry.role}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
              TIER_BADGE_COLORS[entry.tier_name] ?? TIER_BADGE_COLORS.Bystander
            )}
          >
            <TierIcon className="h-3 w-3" />
            {entry.tier_name}
          </span>
          <div className="text-right">
            <div className="text-sm font-semibold text-white">
              {entry.monthly_lp.toLocaleString()}
            </div>
            <div className="text-xs text-surface-500">LP</div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Tier map (all 6 tiers shown as reference) ────────────────────────────────

function TierMap({ activeTier }: { activeTier: string }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {TIER_ORDER.map((tier) => {
        const TierIcon = TIER_ICONS[tier] ?? Shield
        const isActive = tier === activeTier
        const isPast =
          TIER_ORDER.indexOf(tier) < TIER_ORDER.indexOf(activeTier)

        return (
          <div
            key={tier}
            className={cn(
              'flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center',
              isActive
                ? 'border-for-500/40 bg-for-600/10'
                : isPast
                ? 'border-surface-300 bg-surface-200/50 opacity-60'
                : 'border-surface-200 bg-surface-100/50 opacity-40'
            )}
          >
            <TierIcon
              className={cn(
                'h-5 w-5',
                isActive ? 'text-for-400' : isPast ? 'text-surface-500' : 'text-surface-400'
              )}
            />
            <div className={cn('text-xs font-medium', isActive ? 'text-white' : 'text-surface-500')}>
              {tier}
            </div>
            <div className="text-xs text-surface-600">{TIER_THRESHOLDS[tier]}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LeaguePage() {
  const [data, setData] = useState<LeagueResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showTierMap, setShowTierMap] = useState(false)
  const [myUserId, setMyUserId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/league')
      if (!res.ok) throw new Error('Failed to load league data')
      const json: LeagueResponse = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Also fetch current user ID for highlighting
  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setMyUserId(user.id)
      })
    })
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-50">
        <TopBar />
        <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full space-y-5">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div>
              <Skeleton className="h-6 w-36 mb-1" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────────

  if (error || !data) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-50">
        <TopBar />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <EmptyState
            icon={Trophy}
            title="Couldn't load league standings"
            description={error ?? 'Something went wrong'}
            action={{ label: 'Try again', onClick: fetchData }}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  const cu = data.currentUser
  const CurrentTierIcon = cu ? (TIER_ICONS[cu.tier_name] ?? Shield) : Shield

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full pb-24 space-y-5">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <Link href="/leaderboard" className="text-surface-500 hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Trophy className="h-5 w-5 text-gold" />
              Lobby League
            </h1>
            <p className="text-sm text-surface-500">Monthly competitive standings</p>
          </div>
          <button
            onClick={fetchData}
            className="p-2 text-surface-500 hover:text-white transition-colors rounded-lg hover:bg-surface-200"
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* ── Season banner ─────────────────────────────────────────────── */}
        <div className="bg-surface-100 border border-surface-200 rounded-2xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-for-400" />
                <span className="text-sm font-semibold text-white">{data.season_name} Season</span>
              </div>
              <p className="text-xs text-surface-500">
                {data.total_participants.toLocaleString()} participant{data.total_participants !== 1 ? 's' : ''} competing this month
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="flex items-center gap-1 justify-end text-amber-400">
                <Timer className="h-4 w-4" />
                <span className="text-sm font-bold">{data.season_days_left}d left</span>
              </div>
              <p className="text-xs text-surface-500">in this season</p>
            </div>
          </div>
        </div>

        {/* ── Your tier card (logged-in users) ──────────────────────────── */}
        {cu ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className={cn(
              'rounded-2xl border p-5 shadow-lg',
              TIER_GLOW[cu.tier_name],
              cu.tier_name === 'Champion'
                ? 'bg-gradient-to-br from-purple/20 to-for-700/20 border-purple/30'
                : cu.tier_name === 'Senator'
                ? 'bg-gradient-to-br from-gold/10 to-amber-900/20 border-gold/30'
                : cu.tier_name === 'Lawmaker'
                ? 'bg-gradient-to-br from-gray-700/30 to-surface-200 border-gray-600/30'
                : cu.tier_name === 'Delegate'
                ? 'bg-gradient-to-br from-amber-900/20 to-surface-200 border-amber-700/20'
                : cu.tier_name === 'Citizen'
                ? 'bg-gradient-to-br from-for-900/20 to-surface-200 border-for-700/20'
                : 'bg-surface-100 border-surface-200'
            )}
          >
            <div className="flex items-center gap-4 mb-4">
              <div
                className={cn(
                  'h-14 w-14 rounded-2xl flex items-center justify-center border',
                  TIER_BADGE_COLORS[cu.tier_name]
                )}
              >
                <CurrentTierIcon className="h-7 w-7" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-white">{cu.tier_name}</span>
                  {cu.rank && (
                    <span className="text-sm text-surface-400">
                      · Rank <span className="text-white font-semibold">#{cu.rank}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Zap className="h-3.5 w-3.5 text-gold" />
                  <span className="text-2xl font-bold text-white">
                    <AnimatedNumber value={cu.monthly_lp} />
                  </span>
                  <span className="text-sm text-surface-500">LP this month</span>
                </div>
              </div>
            </div>

            <TierProgressBar
              progressPct={cu.progress_pct}
              tierName={cu.tier_name}
              nextTierName={cu.next_tier_name}
              lpToNext={cu.lp_to_next}
              tierColor={cu.tier_name === 'Bystander' ? '#6b7280' : cu.tier_name === 'Citizen' ? '#3b82f6' : cu.tier_name === 'Delegate' ? '#cd7f32' : cu.tier_name === 'Lawmaker' ? '#9ca3af' : cu.tier_name === 'Senator' ? '#c9a84c' : '#a855f7'}
            />

            {cu.next_tier_name && (
              <p className="mt-3 text-xs text-surface-500 text-center">
                Earn <span className="text-white font-semibold">{cu.lp_to_next?.toLocaleString()} more LP</span> to reach{' '}
                <span className="text-white font-semibold">{cu.next_tier_name}</span>
              </p>
            )}
            {!cu.next_tier_name && (
              <p className="mt-3 text-xs text-gold text-center font-medium">
                You&apos;ve reached the highest tier. Defend your standing!
              </p>
            )}
          </motion.div>
        ) : (
          <div className="bg-surface-100 border border-surface-200 rounded-2xl p-5 text-center">
            <Trophy className="h-8 w-8 text-gold mx-auto mb-3" />
            <p className="text-white font-semibold mb-1">Join the League</p>
            <p className="text-sm text-surface-500 mb-4">
              Sign in to track your monthly ranking and tier progress.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 bg-for-600 hover:bg-for-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Sign in
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* ── How to earn LP ────────────────────────────────────────────── */}
        <div className="bg-surface-100 border border-surface-200 rounded-xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-against-400" />
              <span className="text-sm font-medium text-white">How to earn League Points</span>
            </div>
            <button
              onClick={() => setShowTierMap((v) => !v)}
              className="text-xs text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
            >
              Tiers
              <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', showTierMap && 'rotate-90')} />
            </button>
          </div>
          <AnimatePresence>
            {showTierMap && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pt-4 pb-1">
                  <TierMap activeTier={cu?.tier_name ?? 'Bystander'} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-surface-500">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-for-500 flex-shrink-0" />
              Vote on topics
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald flex-shrink-0" />
              Post winning arguments
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple flex-shrink-0" />
              Win debates
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0" />
              Hit daily quorum
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
              Accurate predictions
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-against-400 flex-shrink-0" />
              Claim bounties
            </div>
          </div>
        </div>

        {/* ── Leaderboard ───────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider">
              Top 50 this month
            </h2>
            <span className="text-xs text-surface-600">
              {data.season_name}
            </span>
          </div>

          {data.top50.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="No standings yet"
              description="Be the first to earn League Points this season."
              action={{ label: 'Go to feed', href: '/' }}
            />
          ) : (
            <div className="space-y-1">
              {data.top50.map((entry, i) => (
                <LeaderboardRow
                  key={entry.user_id}
                  entry={entry}
                  isMe={entry.user_id === myUserId}
                  delay={Math.min(i * 0.02, 0.4)}
                />
              ))}
            </div>
          )}

          {/* Show user's rank if outside top 50 */}
          {cu && cu.rank && cu.rank > 50 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 flex items-center gap-3 px-3 py-2.5 rounded-xl bg-for-600/10 border border-for-600/20"
            >
              <span className="text-surface-500 text-sm w-6 text-center">#{cu.rank}</span>
              <div className="flex-1">
                <div className="text-sm text-for-300 font-medium">You</div>
                <div className="text-xs text-surface-500">{cu.tier_name}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-white">{cu.monthly_lp.toLocaleString()}</div>
                <div className="text-xs text-surface-500">LP</div>
              </div>
            </motion.div>
          )}

          {/* CTA to earn more LP */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link
              href="/"
              className="flex items-center justify-center gap-1.5 bg-for-600 hover:bg-for-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
            >
              <Zap className="h-4 w-4" />
              Vote now
            </Link>
            <Link
              href="/challenge"
              className="flex items-center justify-center gap-1.5 bg-surface-100 hover:bg-surface-200 border border-surface-300 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
            >
              <Flame className="h-4 w-4 text-against-400" />
              Daily quorum
            </Link>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
