'use client'

/**
 * /leaderboard/bounties — The Bounty Board
 *
 * Two-tab leaderboard for the Lobby Market bounty system:
 *
 *   Hunters  — citizens ranked by total clout earned winning bounties
 *   Patrons  — citizens ranked by total clout posted as bounty rewards
 *
 * Bounties are clout-staked commissions: a user posts a bounty asking for
 * the best argument on a topic; the creator picks a winner and the clout
 * transfers. This leaderboard surfaces who earns the most by writing
 * great arguments, and who fuels the platform's incentive layer most.
 *
 * Distinct from:
 *   /bounties            — browse open + awarded bounties
 *   /leaderboard/arguments — argument upvote counts
 *   /leaderboard/grades    — AI argument quality scores
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Coins,
  Crown,
  ExternalLink,
  Medal,
  RefreshCw,
  Target,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  BountiesLeaderboardResponse,
  BountyHunter,
  BountyPatron,
} from '@/app/api/leaderboard/bounties/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
  lawmaker: 'Lawmaker',
  senator: 'Senator',
}

const ROLE_BADGE: Record<string, string> = {
  elder: 'border-gold/40 text-gold bg-gold/10',
  senator: 'border-purple/40 text-purple bg-purple/10',
  lawmaker: 'border-gold/60 text-gold bg-gold/20',
  debator: 'border-for-500/40 text-for-300 bg-for-500/10',
  troll_catcher: 'border-emerald/40 text-emerald bg-emerald/10',
  person: 'border-surface-400/40 text-surface-500 bg-surface-300/20',
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-300',
}

function rankIcon(rank: number) {
  if (rank === 1) return <Crown className="h-4 w-4 text-gold" aria-hidden />
  if (rank === 2) return <Medal className="h-4 w-4 text-surface-400" aria-hidden />
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-700" aria-hidden />
  return <span className="text-xs font-mono text-surface-500 w-4 text-center">#{rank}</span>
}

function fmtClout(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '…'
}

// ─── Podium card ──────────────────────────────────────────────────────────────

function PodiumCard({
  entry,
  rank,
  metricLabel,
  metric,
  subMetric,
}: {
  entry: BountyHunter | BountyPatron
  rank: number
  metricLabel: string
  metric: number
  subMetric: string
}) {
  const isFirst = rank === 1
  const displayName = entry.display_name ?? entry.username

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
      className={cn(
        'rounded-2xl bg-surface-100 border p-4 flex flex-col items-center gap-2 text-center',
        isFirst ? 'border-gold/40 ring-1 ring-gold/20' : 'border-surface-300',
      )}
    >
      {isFirst && (
        <Crown className="h-4 w-4 text-gold -mb-1" aria-hidden />
      )}
      {!isFirst && rank === 2 && (
        <Medal className="h-4 w-4 text-surface-400 -mb-1" aria-hidden />
      )}
      {!isFirst && rank === 3 && (
        <Medal className="h-4 w-4 text-amber-700 -mb-1" aria-hidden />
      )}
      <Avatar
        src={entry.avatar_url}
        username={entry.username}
        size={isFirst ? 56 : 44}
      />
      <div>
        <Link
          href={`/profile/${entry.username}`}
          className="text-sm font-mono font-semibold text-white hover:text-gold transition-colors line-clamp-1"
        >
          {truncate(displayName, 14)}
        </Link>
        <p className="text-[11px] font-mono text-surface-500 mt-0.5">
          {ROLE_LABEL[entry.role] ?? entry.role}
        </p>
      </div>
      <div className="mt-1">
        <p className={cn('text-lg font-mono font-bold', isFirst ? 'text-gold' : 'text-white')}>
          {fmtClout(metric)}
        </p>
        <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
          {metricLabel}
        </p>
        <p className="text-[11px] font-mono text-surface-400 mt-0.5">{subMetric}</p>
      </div>
    </motion.div>
  )
}

// ─── Hunter row ───────────────────────────────────────────────────────────────

function HunterRow({ hunter, rank }: { hunter: BountyHunter; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  const displayName = hunter.display_name ?? hunter.username

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: Math.min(rank * 0.02, 0.3) }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 border-b border-surface-300 last:border-0 hover:bg-surface-200/50 transition-colors text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center justify-center w-5 flex-shrink-0">
          {rankIcon(rank)}
        </div>
        <Avatar src={hunter.avatar_url} username={hunter.username} size={36} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/profile/${hunter.username}`}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-mono font-semibold text-white hover:text-gold transition-colors"
            >
              {displayName}
            </Link>
            <span
              className={cn(
                'text-[10px] font-mono px-1.5 py-0.5 rounded-md border',
                ROLE_BADGE[hunter.role] ?? ROLE_BADGE.person,
              )}
            >
              {ROLE_LABEL[hunter.role] ?? hunter.role}
            </span>
          </div>
          <p className="text-[11px] font-mono text-surface-500 mt-0.5">
            {hunter.bounties_won} {hunter.bounties_won === 1 ? 'bounty' : 'bounties'} won ·{' '}
            Best: {hunter.biggest_win} clout
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-base font-mono font-bold text-gold">
            {fmtClout(hunter.clout_earned)}
          </p>
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">clout</p>
        </div>
      </button>

      <AnimatePresence>
        {expanded && hunter.top_topic_statement && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-5 py-3 bg-surface-200/40 border-b border-surface-300 flex items-start gap-3">
              <Target className="h-4 w-4 text-gold mt-0.5 flex-shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wide mb-1">
                  Best bounty topic
                </p>
                <p className="text-sm font-mono text-surface-300 line-clamp-2">
                  {hunter.top_topic_statement}
                </p>
                {hunter.top_topic_category && (
                  <span
                    className={cn(
                      'text-[10px] font-mono mt-1 block',
                      CATEGORY_COLOR[hunter.top_topic_category] ?? 'text-surface-500',
                    )}
                  >
                    {hunter.top_topic_category}
                  </span>
                )}
              </div>
              <Link
                href={`/profile/${hunter.username}`}
                onClick={(e) => e.stopPropagation()}
                className="flex-shrink-0 text-surface-500 hover:text-white transition-colors"
                aria-label="View profile"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Patron row ───────────────────────────────────────────────────────────────

function PatronRow({ patron, rank }: { patron: BountyPatron; rank: number }) {
  const displayName = patron.display_name ?? patron.username

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: Math.min(rank * 0.02, 0.3) }}
      className="flex items-center gap-3 px-5 py-3.5 border-b border-surface-300 last:border-0"
    >
      <div className="flex items-center justify-center w-5 flex-shrink-0">
        {rankIcon(rank)}
      </div>
      <Avatar src={patron.avatar_url} username={patron.username} size={36} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/profile/${patron.username}`}
            className="text-sm font-mono font-semibold text-white hover:text-gold transition-colors"
          >
            {displayName}
          </Link>
          <span
            className={cn(
              'text-[10px] font-mono px-1.5 py-0.5 rounded-md border',
              ROLE_BADGE[patron.role] ?? ROLE_BADGE.person,
            )}
          >
            {ROLE_LABEL[patron.role] ?? patron.role}
          </span>
        </div>
        <p className="text-[11px] font-mono text-surface-500 mt-0.5">
          {patron.bounties_created} posted · {patron.bounties_awarded} awarded ·{' '}
          <span className={patron.award_rate >= 70 ? 'text-emerald' : 'text-surface-400'}>
            {patron.award_rate}% award rate
          </span>
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-base font-mono font-bold text-purple">
          {fmtClout(patron.clout_posted)}
        </p>
        <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">staked</p>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = 'hunters' | 'patrons'

export default function BountiesLeaderboardPage() {
  const [tab, setTab] = useState<Tab>('hunters')
  const [data, setData] = useState<BountiesLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/leaderboard/bounties?limit=50')
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as BountiesLeaderboardResponse
      setData(json)
    } catch {
      setError('Could not load the bounties leaderboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const hunters = data?.hunters ?? []
  const patrons = data?.patrons ?? []
  const stats = data?.stats ?? []

  const topHunters = hunters.slice(0, 3)
  const restHunters = hunters.slice(3)
  const topPatrons = patrons.slice(0, 3)
  const restPatrons = patrons.slice(3)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/leaderboard"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-100 border border-surface-300 hover:bg-surface-200 transition-colors flex-shrink-0"
            aria-label="Back to leaderboard"
          >
            <ArrowLeft className="h-4 w-4 text-surface-400" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
              <Coins className="h-5 w-5 text-gold" aria-hidden />
            </div>
            <div>
              <h1 className="text-xl font-mono font-bold text-white">Bounty Board</h1>
              <p className="text-xs font-mono text-surface-500">
                Who earns the most — and who funds the chase
              </p>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        {!loading && stats.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-3 mb-6"
          >
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center"
              >
                <p className="text-lg font-mono font-bold text-white">{s.value}</p>
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">{s.label}</p>
                {s.sub && (
                  <p className="text-[10px] font-mono text-surface-500 mt-0.5">{s.sub}</p>
                )}
              </div>
            ))}
          </motion.div>
        )}

        {loading && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
          {([
            { id: 'hunters' as Tab, label: 'Hunters', icon: Trophy, color: 'text-gold', activeColor: 'bg-gold/15 border-gold/40 text-gold' },
            { id: 'patrons' as Tab, label: 'Patrons', icon: Zap, color: 'text-purple', activeColor: 'bg-purple/15 border-purple/40 text-purple' },
          ] as const).map(({ id, label, icon: Icon, activeColor }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-mono font-medium transition-colors flex-shrink-0',
                tab === id
                  ? activeColor
                  : 'border-surface-300 text-surface-400 hover:text-white hover:border-surface-200',
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
              {!loading && (
                <span className="text-[10px] text-surface-500 ml-0.5">
                  ({id === 'hunters' ? hunters.length : patrons.length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
            <p className="text-surface-400 font-mono text-sm mb-4">{error}</p>
            <button
              onClick={load}
              className="flex items-center gap-2 mx-auto text-sm font-mono text-surface-400 hover:text-white transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        {/* Hunters tab */}
        {!error && tab === 'hunters' && (
          <AnimatePresence mode="wait">
            <motion.div
              key="hunters"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {loading ? (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} className="h-44 rounded-2xl" />
                    ))}
                  </div>
                  <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 px-5 py-3.5 border-b border-surface-300 last:border-0">
                        <Skeleton className="h-4 w-5 flex-shrink-0" />
                        <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                        <div className="text-right space-y-1.5">
                          <Skeleton className="h-5 w-14" />
                          <Skeleton className="h-3 w-8" />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : hunters.length === 0 ? (
                <EmptyState
                  icon={Trophy}
                  title="No bounties claimed yet"
                  description="Be the first to win a bounty by writing a killer argument on an open topic."
                  action={{ label: 'Browse bounties', href: '/bounties' }}
                />
              ) : (
                <>
                  {/* Podium */}
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {[1, 0, 2].map((podiumIdx) => {
                      const hunter = topHunters[podiumIdx]
                      if (!hunter) return <div key={podiumIdx} />
                      return (
                        <PodiumCard
                          key={hunter.user_id}
                          entry={hunter}
                          rank={podiumIdx + 1}
                          metricLabel="clout earned"
                          metric={hunter.clout_earned}
                          subMetric={`${hunter.bounties_won} ${hunter.bounties_won === 1 ? 'win' : 'wins'}`}
                        />
                      )
                    })}
                  </div>

                  {/* Ranked list */}
                  {restHunters.length > 0 && (
                    <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                      {restHunters.map((h, i) => (
                        <HunterRow key={h.user_id} hunter={h} rank={i + 4} />
                      ))}
                    </div>
                  )}

                  <p className="text-center text-xs font-mono text-surface-600 mt-6">
                    Ranked by total clout earned from winning bounties
                  </p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Patrons tab */}
        {!error && tab === 'patrons' && (
          <AnimatePresence mode="wait">
            <motion.div
              key="patrons"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {loading ? (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} className="h-44 rounded-2xl" />
                    ))}
                  </div>
                  <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 px-5 py-3.5 border-b border-surface-300 last:border-0">
                        <Skeleton className="h-4 w-5 flex-shrink-0" />
                        <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                        <div className="text-right space-y-1.5">
                          <Skeleton className="h-5 w-14" />
                          <Skeleton className="h-3 w-8" />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : patrons.length === 0 ? (
                <EmptyState
                  icon={Coins}
                  title="No bounties posted yet"
                  description="Post a bounty to commission the community's best argument on any topic."
                  action={{ label: 'Browse topics', href: '/' }}
                />
              ) : (
                <>
                  {/* Podium */}
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {[1, 0, 2].map((podiumIdx) => {
                      const patron = topPatrons[podiumIdx]
                      if (!patron) return <div key={podiumIdx} />
                      return (
                        <PodiumCard
                          key={patron.user_id}
                          entry={patron}
                          rank={podiumIdx + 1}
                          metricLabel="clout staked"
                          metric={patron.clout_posted}
                          subMetric={`${patron.bounties_created} ${patron.bounties_created === 1 ? 'bounty' : 'bounties'}`}
                        />
                      )
                    })}
                  </div>

                  {/* Ranked list */}
                  {restPatrons.length > 0 && (
                    <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                      {restPatrons.map((p, i) => (
                        <PatronRow key={p.user_id} patron={p} rank={i + 4} />
                      ))}
                    </div>
                  )}

                  <p className="text-center text-xs font-mono text-surface-600 mt-6">
                    Ranked by total clout staked in posted bounties
                  </p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
