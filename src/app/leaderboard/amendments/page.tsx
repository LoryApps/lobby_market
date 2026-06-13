'use client'

/**
 * /leaderboard/amendments — Amendment Architects Leaderboard
 *
 * Ranks citizens by their engagement with the law amendment system:
 *   Proposers   — most amendments submitted (all time)
 *   Architects  — highest ratification success rate (min 2 proposed)
 *   Voters      — most amendment votes cast
 *
 * Also shows recent ratified/rejected outcomes and platform-wide stats.
 *
 * Distinct from:
 *   /amendments          — global amendment browser (vote on pending ones)
 *   /law/[id]/amendments — amendments for a specific law
 *   /leaderboard/lawmakers — users who co-authored the most laws via FOR votes
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Crown,
  Edit3,
  ExternalLink,
  FileText,
  Gavel,
  RefreshCw,
  Scale,
  Trophy,
  Vote,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  AmendmentLeaderboardResponse,
  AmendmentArchitect,
  AmendmentVoter,
  RecentOutcome,
} from '@/app/api/leaderboard/amendments/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rankColor(rank: number): string {
  if (rank === 1) return 'text-gold'
  if (rank === 2) return 'text-surface-300'
  if (rank === 3) return 'text-amber-600'
  return 'text-surface-500'
}

function rankBg(rank: number): string {
  if (rank === 1) return 'bg-gold/10 border-gold/30'
  if (rank === 2) return 'bg-surface-300/10 border-surface-400/30'
  if (rank === 3) return 'bg-amber-600/10 border-amber-600/30'
  return 'bg-surface-200/50 border-surface-300/50'
}

function rankIcon(rank: number) {
  if (rank === 1) return <Crown className="h-3.5 w-3.5 text-gold" />
  if (rank === 2) return <Trophy className="h-3.5 w-3.5 text-surface-300" />
  if (rank === 3) return <Trophy className="h-3.5 w-3.5 text-amber-600" />
  return null
}

const ROLE_COLORS: Record<string, string> = {
  elder: 'text-gold',
  troll_catcher: 'text-emerald',
  debator: 'text-for-400',
  senator: 'text-purple',
  person: 'text-surface-500',
}

const ROLE_LABELS: Record<string, string> = {
  elder: 'Elder',
  troll_catcher: 'Troll Catcher',
  debator: 'Debator',
  senator: 'Senator',
  person: 'Citizen',
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── SkeletonRow ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-100 border border-surface-300/50">
      <Skeleton className="h-5 w-5 rounded" />
      <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-5 w-12" />
    </div>
  )
}

// ─── ProposerRow ─────────────────────────────────────────────────────────────

function ProposerRow({ entry, rank }: { entry: AmendmentArchitect; rank: number }) {
  const roleColor = ROLE_COLORS[entry.role] ?? 'text-surface-500'
  const roleLabel = ROLE_LABELS[entry.role] ?? 'Citizen'
  const resolved = entry.ratified + entry.rejected
  const successWidth = resolved > 0 ? Math.round((entry.ratified / resolved) * 100) : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: rank * 0.03 }}
      className={cn(
        'flex items-center gap-3 p-4 rounded-xl border transition-colors',
        rank <= 3 ? rankBg(rank) : 'bg-surface-100 border-surface-300/50 hover:border-surface-400/50'
      )}
    >
      {/* Rank */}
      <div className={cn('w-6 text-center flex-shrink-0', rankColor(rank))}>
        {rank <= 3 ? (
          <div className="flex justify-center">{rankIcon(rank)}</div>
        ) : (
          <span className="font-mono text-xs">{rank}</span>
        )}
      </div>

      {/* Avatar */}
      <Avatar
        username={entry.username}
        avatarUrl={entry.avatar_url}
        size="sm"
        className="flex-shrink-0"
      />

      {/* Identity */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${entry.username}`}
          className="font-mono text-sm font-semibold text-white hover:text-for-300 transition-colors truncate block"
        >
          {entry.display_name ?? entry.username}
        </Link>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn('font-mono text-xs', roleColor)}>{roleLabel}</span>
          {entry.pending > 0 && (
            <span className="font-mono text-xs text-surface-500">· {entry.pending} pending</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="text-right flex-shrink-0 space-y-0.5">
        <div className="font-mono text-sm font-bold text-white">{entry.proposed}</div>
        <div className="font-mono text-xs text-surface-500">proposed</div>
      </div>

      <div className="text-right flex-shrink-0 w-20 space-y-1">
        <div className="flex items-center justify-end gap-1.5">
          <span className="font-mono text-xs text-emerald">{entry.ratified}✓</span>
          <span className="font-mono text-xs text-against-400">{entry.rejected}✗</span>
        </div>
        {resolved > 0 && (
          <div className="h-1 w-full bg-surface-300 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald rounded-full"
              style={{ width: `${successWidth}%` }}
            />
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── ArchitectRow ────────────────────────────────────────────────────────────

function ArchitectRow({ entry, rank }: { entry: AmendmentArchitect; rank: number }) {
  const roleColor = ROLE_COLORS[entry.role] ?? 'text-surface-500'
  const roleLabel = ROLE_LABELS[entry.role] ?? 'Citizen'

  const rateColor =
    entry.success_rate >= 80
      ? 'text-emerald'
      : entry.success_rate >= 60
        ? 'text-for-400'
        : entry.success_rate >= 40
          ? 'text-gold'
          : 'text-against-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: rank * 0.03 }}
      className={cn(
        'flex items-center gap-3 p-4 rounded-xl border transition-colors',
        rank <= 3 ? rankBg(rank) : 'bg-surface-100 border-surface-300/50 hover:border-surface-400/50'
      )}
    >
      <div className={cn('w-6 text-center flex-shrink-0', rankColor(rank))}>
        {rank <= 3 ? (
          <div className="flex justify-center">{rankIcon(rank)}</div>
        ) : (
          <span className="font-mono text-xs">{rank}</span>
        )}
      </div>

      <Avatar
        username={entry.username}
        avatarUrl={entry.avatar_url}
        size="sm"
        className="flex-shrink-0"
      />

      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${entry.username}`}
          className="font-mono text-sm font-semibold text-white hover:text-for-300 transition-colors truncate block"
        >
          {entry.display_name ?? entry.username}
        </Link>
        <span className={cn('font-mono text-xs', roleColor)}>{roleLabel}</span>
      </div>

      <div className="text-right flex-shrink-0 w-24">
        <div className={cn('font-mono text-lg font-bold', rateColor)}>
          {entry.success_rate}%
        </div>
        <div className="font-mono text-xs text-surface-500">
          {entry.ratified}/{entry.ratified + entry.rejected} ratified
        </div>
      </div>
    </motion.div>
  )
}

// ─── VoterRow ────────────────────────────────────────────────────────────────

function VoterRow({ entry, rank }: { entry: AmendmentVoter; rank: number }) {
  const roleColor = ROLE_COLORS[entry.role] ?? 'text-surface-500'
  const roleLabel = ROLE_LABELS[entry.role] ?? 'Citizen'
  const forPct = entry.votes_cast > 0 ? Math.round((entry.for_votes / entry.votes_cast) * 100) : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: rank * 0.03 }}
      className={cn(
        'flex items-center gap-3 p-4 rounded-xl border transition-colors',
        rank <= 3 ? rankBg(rank) : 'bg-surface-100 border-surface-300/50 hover:border-surface-400/50'
      )}
    >
      <div className={cn('w-6 text-center flex-shrink-0', rankColor(rank))}>
        {rank <= 3 ? (
          <div className="flex justify-center">{rankIcon(rank)}</div>
        ) : (
          <span className="font-mono text-xs">{rank}</span>
        )}
      </div>

      <Avatar
        username={entry.username}
        avatarUrl={entry.avatar_url}
        size="sm"
        className="flex-shrink-0"
      />

      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${entry.username}`}
          className="font-mono text-sm font-semibold text-white hover:text-for-300 transition-colors truncate block"
        >
          {entry.display_name ?? entry.username}
        </Link>
        <span className={cn('font-mono text-xs', roleColor)}>{roleLabel}</span>
      </div>

      <div className="text-right flex-shrink-0 space-y-0.5">
        <div className="font-mono text-sm font-bold text-white">{entry.votes_cast}</div>
        <div className="flex items-center justify-end gap-1 font-mono text-xs">
          <span className="text-for-400">{entry.for_votes}↑</span>
          <span className="text-against-400">{entry.against_votes}↓</span>
        </div>
      </div>

      <div className="flex-shrink-0 w-12 h-1 bg-surface-300 rounded-full overflow-hidden">
        <div className="h-full bg-for-500 rounded-full" style={{ width: `${forPct}%` }} />
      </div>
    </motion.div>
  )
}

// ─── RecentOutcomeCard ───────────────────────────────────────────────────────

function RecentOutcomeCard({ outcome }: { outcome: RecentOutcome }) {
  const ratified = outcome.status === 'ratified'
  const total = outcome.for_count + outcome.against_count
  const forPct = total > 0 ? Math.round((outcome.for_count / total) * 100) : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 space-y-2',
        ratified
          ? 'bg-emerald/5 border-emerald/20'
          : 'bg-against-500/5 border-against-500/20'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {ratified ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald flex-shrink-0" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
          )}
          <span className={cn('font-mono text-xs font-semibold', ratified ? 'text-emerald' : 'text-against-400')}>
            {ratified ? 'Ratified' : 'Rejected'}
          </span>
          <span className="font-mono text-xs text-surface-500">· {relativeTime(outcome.resolved_at)}</span>
        </div>
        <Link
          href={`/law/${outcome.law_id}/amendments`}
          className="text-surface-500 hover:text-white transition-colors flex-shrink-0"
          aria-label="View amendment"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <p className="font-mono text-sm font-semibold text-white leading-snug line-clamp-2">
        {outcome.title}
      </p>

      <p className="font-mono text-xs text-surface-500 line-clamp-1">
        re: {outcome.law_statement}
      </p>

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center gap-1 font-mono text-xs">
          <Avatar username={outcome.proposer_username} avatarUrl={outcome.proposer_avatar} size="xs" />
          <span className="text-surface-400">{outcome.proposer_username}</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-for-400">{outcome.for_count}↑</span>
          <span className="text-against-400">{outcome.against_count}↓</span>
          <span className="text-surface-500">{forPct}% FOR</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'proposers' | 'architects' | 'voters'

const TABS: { id: Tab; label: string; icon: typeof Edit3 }[] = [
  { id: 'proposers', label: 'Proposers', icon: FileText },
  { id: 'architects', label: 'Architects', icon: Edit3 },
  { id: 'voters', label: 'Voters', icon: Vote },
]

// ─── Main client ─────────────────────────────────────────────────────────────

function AmendmentLeaderboardClient() {
  const [data, setData] = useState<AmendmentLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('proposers')
  const fetchedRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/leaderboard/amendments', { cache: 'no-store' })
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true
      load()
    }
  }, [load])

  const totals = data?.totals
  const myStats = data?.myStats

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Leaderboard
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0">
                <Edit3 className="h-5 w-5 text-emerald" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">
                  Amendment Architects
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Who shapes the Codex? Citizens ranked by amendment success.
                </p>
              </div>
            </div>

            <button
              onClick={load}
              disabled={loading}
              className="flex-shrink-0 p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* ── Platform stats strip ──────────────────────────────────────── */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
          {(
            [
              { label: 'Total', value: totals?.total_amendments ?? 0, color: 'text-white' },
              { label: 'Ratified', value: totals?.ratified ?? 0, color: 'text-emerald' },
              { label: 'Rejected', value: totals?.rejected ?? 0, color: 'text-against-400' },
              { label: 'Pending', value: totals?.pending ?? 0, color: 'text-gold' },
              { label: 'Proposers', value: totals?.unique_proposers ?? 0, color: 'text-purple' },
              { label: 'Laws', value: totals?.unique_laws_amended ?? 0, color: 'text-for-400' },
            ] as const
          ).map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center"
            >
              <div className={cn('font-mono text-lg font-bold', color)}>
                {loading ? <Skeleton className="h-6 w-10 mx-auto" /> : <AnimatedNumber value={value} />}
              </div>
              <div className="font-mono text-xs text-surface-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* ── My Stats ────────────────────────────────────────────────────── */}
        {myStats && (myStats.proposed > 0 || myStats.votes_cast > 0) && (
          <div className="mb-6 rounded-2xl bg-for-500/5 border border-for-500/20 p-4">
            <p className="font-mono text-xs text-for-400 uppercase tracking-wider mb-3">Your Amendment Record</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center">
                <div className="font-mono text-xl font-bold text-white">{myStats.proposed}</div>
                <div className="font-mono text-xs text-surface-500">proposed</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-xl font-bold text-emerald">{myStats.ratified}</div>
                <div className="font-mono text-xs text-surface-500">ratified</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-xl font-bold text-gold">{myStats.success_rate}%</div>
                <div className="font-mono text-xs text-surface-500">success rate</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-xl font-bold text-purple">{myStats.votes_cast}</div>
                <div className="font-mono text-xs text-surface-500">votes cast</div>
              </div>
            </div>
            {myStats.proposer_rank !== null && (
              <p className="font-mono text-xs text-surface-500 text-center mt-3">
                You rank <span className="text-white font-bold">#{myStats.proposer_rank}</span> among proposers
                {myStats.voter_rank !== null && (
                  <> and <span className="text-white font-bold">#{myStats.voter_rank}</span> among voters</>
                )}
              </p>
            )}
          </div>
        )}

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 bg-surface-200/50 p-1 rounded-xl mb-4">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-mono text-xs font-semibold transition-colors',
                tab === id
                  ? 'bg-surface-100 text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-300'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab descriptions ─────────────────────────────────────────── */}
        <div className="mb-4 font-mono text-xs text-surface-500">
          {tab === 'proposers' && 'Citizens ranked by total amendments submitted — the most active shapers of established law.'}
          {tab === 'architects' && 'Citizens with the highest ratification rate. Minimum 2 proposals with at least 1 resolved.'}
          {tab === 'voters' && 'Citizens who participate most actively in amendment voting — the democratic engine of law refinement.'}
        </div>

        {/* ── List ────────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <div key="skeleton" className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : (
            <div key={tab} className="space-y-2">
              {tab === 'proposers' && (
                <>
                  {data?.proposers.length === 0 ? (
                    <EmptyState
                      icon={FileText}
                      title="No amendments yet"
                      description="Be the first to propose an amendment to an established law."
                      action={{ label: 'Browse Laws', href: '/law' }}
                    />
                  ) : (
                    data?.proposers.map((entry, i) => (
                      <ProposerRow key={entry.user_id} entry={entry} rank={i + 1} />
                    ))
                  )}
                </>
              )}

              {tab === 'architects' && (
                <>
                  {data?.architects.length === 0 ? (
                    <EmptyState
                      icon={Edit3}
                      title="No qualified architects yet"
                      description="Citizens need at least 2 proposed amendments with 1 resolved to appear here."
                      action={{ label: 'Propose an Amendment', href: '/amendments' }}
                    />
                  ) : (
                    data?.architects.map((entry, i) => (
                      <ArchitectRow key={entry.user_id} entry={entry} rank={i + 1} />
                    ))
                  )}
                </>
              )}

              {tab === 'voters' && (
                <>
                  {data?.voters.length === 0 ? (
                    <EmptyState
                      icon={Vote}
                      title="No amendment votes yet"
                      description="Vote on pending amendments to appear in this ranking."
                      action={{ label: 'View Amendments', href: '/amendments' }}
                    />
                  ) : (
                    data?.voters.map((entry, i) => (
                      <VoterRow key={entry.user_id} entry={entry} rank={i + 1} />
                    ))
                  )}
                </>
              )}
            </div>
          )}
        </AnimatePresence>

        {/* ── Recent Outcomes ──────────────────────────────────────────── */}
        {!loading && (data?.recentOutcomes.length ?? 0) > 0 && (
          <section className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-mono text-sm font-semibold text-white flex items-center gap-2">
                <Scale className="h-4 w-4 text-gold" />
                Recent Outcomes
              </h2>
              <Link
                href="/amendments"
                className="font-mono text-xs text-surface-500 hover:text-white transition-colors flex items-center gap-1"
              >
                All amendments <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data!.recentOutcomes.map((outcome) => (
                <RecentOutcomeCard key={outcome.amendment_id} outcome={outcome} />
              ))}
            </div>
          </section>
        )}

        {/* ── Quick links ──────────────────────────────────────────────── */}
        <section className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/amendments"
            className="flex items-center justify-between rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 hover:border-emerald/40 hover:bg-emerald/5 transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <Edit3 className="h-4 w-4 text-emerald" />
              <div>
                <p className="font-mono text-sm font-semibold text-white">Amendment Chamber</p>
                <p className="font-mono text-xs text-surface-500">Vote on pending amendments</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors" />
          </Link>

          <Link
            href="/law"
            className="flex items-center justify-between rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 hover:border-gold/40 hover:bg-gold/5 transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <Gavel className="h-4 w-4 text-gold" />
              <div>
                <p className="font-mono text-sm font-semibold text-white">The Codex</p>
                <p className="font-mono text-xs text-surface-500">Browse established laws</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors" />
          </Link>
        </section>
      </main>

      <BottomNav />
    </div>
  )
}

// ─── Page export ─────────────────────────────────────────────────────────────

export default function AmendmentLeaderboardPage() {
  return (
    <Suspense>
      <AmendmentLeaderboardClient />
    </Suspense>
  )
}
