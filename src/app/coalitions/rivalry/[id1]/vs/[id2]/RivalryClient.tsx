'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Crown,
  ExternalLink,
  GitCompare,
  RefreshCw,
  Scale,
  Shield,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Zap,
  CheckCircle2,
  XCircle,
  Minus,
  Clock,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type {
  RivalryResponse,
  RivalryCoalition,
  HeadToHeadChallenge,
  SharedStance,
} from '@/app/api/coalitions/rivalry/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STANCE_ICON: Record<'for' | 'against' | 'neutral', typeof ThumbsUp> = {
  for: ThumbsUp,
  against: ThumbsDown,
  neutral: Minus,
}

const STANCE_LABEL: Record<'for' | 'against' | 'neutral', string> = {
  for: 'FOR',
  against: 'AGAINST',
  neutral: 'NEUTRAL',
}

const STANCE_COLOR: Record<'for' | 'against' | 'neutral', string> = {
  for: 'text-for-400',
  against: 'text-against-400',
  neutral: 'text-surface-400',
}

const STANCE_BG: Record<'for' | 'against' | 'neutral', string> = {
  for: 'bg-for-500/10 border-for-500/30',
  against: 'bg-against-500/10 border-against-500/30',
  neutral: 'bg-surface-300/10 border-surface-300/20',
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  proposed: { label: 'Proposed', color: 'text-surface-500' },
  active:   { label: 'Active',   color: 'text-for-400' },
  voting:   { label: 'Voting',   color: 'text-purple' },
  law:      { label: 'LAW',      color: 'text-gold' },
  failed:   { label: 'Failed',   color: 'text-surface-600' },
}

function fmtInfluence(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toFixed(0)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CoalitionCard({
  coalition,
  side,
  wins,
  total,
}: {
  coalition: RivalryCoalition
  side: 'A' | 'B'
  wins: number
  total: number
}) {
  const winRate = total > 0 ? Math.round((wins / total) * 100) : null
  const isA = side === 'A'

  return (
    <Link
      href={`/coalitions/${coalition.id}`}
      className={cn(
        'flex flex-col gap-3 p-5 rounded-2xl border transition-all group',
        'bg-surface-100 border-surface-300 hover:border-surface-400',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex items-center justify-center h-10 w-10 rounded-xl flex-shrink-0',
            isA
              ? 'bg-for-500/10 border border-for-500/30'
              : 'bg-against-500/10 border border-against-500/30',
          )}
        >
          <Shield className={cn('h-4.5 w-4.5', isA ? 'text-for-400' : 'text-against-400')} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono font-bold text-white truncate text-sm group-hover:text-for-300 transition-colors">
            {coalition.name}
          </p>
          {coalition.description && (
            <p className="text-[11px] text-surface-500 mt-0.5 line-clamp-2 font-mono">
              {coalition.description}
            </p>
          )}
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-surface-300">
        <div className="text-center">
          <p className="font-mono text-sm font-bold text-white">{coalition.member_count}</p>
          <p className="font-mono text-[10px] text-surface-500 uppercase tracking-wider mt-0.5">Members</p>
        </div>
        <div className="text-center">
          <p className={cn('font-mono text-sm font-bold', isA ? 'text-for-400' : 'text-against-400')}>
            {fmtInfluence(coalition.coalition_influence)}
          </p>
          <p className="font-mono text-[10px] text-surface-500 uppercase tracking-wider mt-0.5">Influence</p>
        </div>
        <div className="text-center">
          <p className={cn('font-mono text-sm font-bold', winRate !== null ? 'text-gold' : 'text-surface-500')}>
            {winRate !== null ? `${winRate}%` : '—'}
          </p>
          <p className="font-mono text-[10px] text-surface-500 uppercase tracking-wider mt-0.5">H2H Win%</p>
        </div>
      </div>
    </Link>
  )
}

function ScoreDisplay({
  aWins,
  bWins,
  draws,
  total,
  nameA,
  nameB,
}: {
  aWins: number
  bWins: number
  draws: number
  total: number
  nameA: string
  nameB: string
}) {
  if (total === 0) return null

  const aLead = aWins > bWins
  const bLead = bWins > aWins
  const tied = aWins === bWins

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-6">
        <Trophy className="h-3.5 w-3.5 text-gold" />
        Head-to-Head Record
      </div>

      <div className="flex items-center justify-between gap-4">
        {/* A side */}
        <div className="flex flex-col items-center gap-1 flex-1">
          <span
            className={cn(
              'font-mono text-5xl font-black tabular-nums',
              aLead ? 'text-for-400' : 'text-surface-500',
            )}
          >
            {aWins}
          </span>
          <span className="font-mono text-xs text-surface-500 truncate max-w-[100px] text-center">
            {nameA}
          </span>
          {aLead && <Crown className="h-4 w-4 text-gold mt-0.5" />}
        </div>

        {/* Center */}
        <div className="flex flex-col items-center gap-1">
          <Swords className="h-8 w-8 text-surface-400" />
          {draws > 0 && (
            <span className="font-mono text-xs text-surface-500">{draws} draw{draws !== 1 ? 's' : ''}</span>
          )}
          {tied && total > 0 && (
            <span className="font-mono text-xs text-gold">TIED</span>
          )}
        </div>

        {/* B side */}
        <div className="flex flex-col items-center gap-1 flex-1">
          <span
            className={cn(
              'font-mono text-5xl font-black tabular-nums',
              bLead ? 'text-against-400' : 'text-surface-500',
            )}
          >
            {bWins}
          </span>
          <span className="font-mono text-xs text-surface-500 truncate max-w-[100px] text-center">
            {nameB}
          </span>
          {bLead && <Crown className="h-4 w-4 text-gold mt-0.5" />}
        </div>
      </div>

      {/* Win bar */}
      <div className="mt-6 h-2 rounded-full overflow-hidden flex gap-0.5 bg-surface-300">
        {aWins > 0 && (
          <div
            className="h-full bg-for-500 rounded-l-full transition-all"
            style={{ width: `${(aWins / total) * 100}%` }}
          />
        )}
        {draws > 0 && (
          <div
            className="h-full bg-surface-400 transition-all"
            style={{ width: `${(draws / total) * 100}%` }}
          />
        )}
        {bWins > 0 && (
          <div
            className="h-full bg-against-500 rounded-r-full transition-all"
            style={{ width: `${(bWins / total) * 100}%` }}
          />
        )}
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="font-mono text-[10px] text-for-400">{aWins}W</span>
        {draws > 0 && <span className="font-mono text-[10px] text-surface-500">{draws}D</span>}
        <span className="font-mono text-[10px] text-against-400">{bWins}W</span>
      </div>
    </div>
  )
}

function SimilarityMeter({ score }: { score: number }) {
  const label =
    score >= 80 ? 'Aligned Allies' :
    score >= 60 ? 'Mostly Aligned' :
    score >= 40 ? 'Mixed Overlap' :
    score >= 20 ? 'Often Opposed' :
    'Rival Factions'

  const color =
    score >= 70 ? 'text-emerald' :
    score >= 40 ? 'text-gold' :
    'text-against-400'

  const barColor =
    score >= 70 ? 'bg-emerald' :
    score >= 40 ? 'bg-gold' :
    'bg-against-500'

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider">
          <GitCompare className="h-3.5 w-3.5 text-purple" />
          Stance Alignment
        </div>
        <span className={cn('font-mono text-sm font-bold', color)}>{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-surface-300 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={cn('h-full rounded-full', barColor)}
          />
        </div>
        <span className={cn('font-mono text-sm font-bold tabular-nums w-10 text-right', color)}>
          {score}%
        </span>
      </div>
    </div>
  )
}

function ChallengeRow({
  challenge,
  idA,
  nameA,
  nameB,
}: {
  challenge: HeadToHeadChallenge
  idA: string
  nameA: string
  nameB: string
}) {
  const isResolved = challenge.status === 'resolved'
  const aWon = challenge.winnerId === idA
  const bWon = !!challenge.winnerId && challenge.winnerId !== idA
  const statusBadge = STATUS_BADGE[challenge.topicStatus] ?? { label: challenge.topicStatus, color: 'text-surface-500' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-all"
    >
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div className="flex-shrink-0 mt-0.5">
          {isResolved ? (
            aWon ? (
              <Trophy className="h-4 w-4 text-gold" />
            ) : bWon ? (
              <Trophy className="h-4 w-4 text-against-400" />
            ) : (
              <Scale className="h-4 w-4 text-surface-500" />
            )
          ) : challenge.status === 'pending' ? (
            <Clock className="h-4 w-4 text-gold" />
          ) : challenge.status === 'accepted' ? (
            <Swords className="h-4 w-4 text-purple" />
          ) : (
            <XCircle className="h-4 w-4 text-surface-600" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <Link href={`/topic/${challenge.topicId}`} className="group">
            <p className="font-mono text-sm text-white group-hover:text-for-300 transition-colors line-clamp-2">
              {challenge.topicStatement}
            </p>
          </Link>

          {/* Stances */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {challenge.aStance && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
                  STANCE_BG[challenge.aStance],
                  STANCE_COLOR[challenge.aStance],
                )}
              >
                {nameA.slice(0, 8)}: {STANCE_LABEL[challenge.aStance]}
              </span>
            )}
            {challenge.bStance && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
                  STANCE_BG[challenge.bStance],
                  STANCE_COLOR[challenge.bStance],
                )}
              >
                {nameB.slice(0, 8)}: {STANCE_LABEL[challenge.bStance]}
              </span>
            )}
            {challenge.stakeClout > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-gold">
                <Zap className="h-2.5 w-2.5" />
                {challenge.stakeClout.toLocaleString()} staked
              </span>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className={cn('font-mono text-[10px] uppercase tracking-wider', statusBadge.color)}>
              {statusBadge.label}
            </span>
            <span className="text-surface-600 text-[10px]">·</span>
            <span className="font-mono text-[10px] text-surface-500">
              {relativeTime(challenge.createdAt)}
            </span>
            {isResolved && challenge.winnerId && (
              <>
                <span className="text-surface-600 text-[10px]">·</span>
                <span className={cn('font-mono text-[10px] font-bold', aWon ? 'text-for-400' : 'text-against-400')}>
                  {aWon ? nameA : nameB} wins
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function StanceRow({ stance, nameA, nameB }: { stance: SharedStance; nameA: string; nameB: string }) {
  const IconA = STANCE_ICON[stance.aStance]
  const IconB = STANCE_ICON[stance.bStance]
  const statusBadge = STATUS_BADGE[stance.topicStatus] ?? { label: stance.topicStatus, color: 'text-surface-500' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'p-4 rounded-xl border transition-all',
        stance.agree
          ? 'bg-emerald/5 border-emerald/20 hover:border-emerald/40'
          : 'bg-against-500/5 border-against-500/20 hover:border-against-500/40',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {stance.agree ? (
            <CheckCircle2 className="h-4 w-4 text-emerald" />
          ) : (
            <XCircle className="h-4 w-4 text-against-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <Link href={`/topic/${stance.topicId}`} className="group">
            <p className="font-mono text-sm text-white group-hover:text-for-300 transition-colors line-clamp-2">
              {stance.topicStatement}
            </p>
          </Link>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
                STANCE_BG[stance.aStance],
                STANCE_COLOR[stance.aStance],
              )}
            >
              <IconA className="h-2.5 w-2.5" />
              {nameA.slice(0, 10)}: {STANCE_LABEL[stance.aStance]}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
                STANCE_BG[stance.bStance],
                STANCE_COLOR[stance.bStance],
              )}
            >
              <IconB className="h-2.5 w-2.5" />
              {nameB.slice(0, 10)}: {STANCE_LABEL[stance.bStance]}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={cn('font-mono text-[10px] uppercase tracking-wider', statusBadge.color)}>
              {statusBadge.label}
            </span>
            <span className="text-surface-600 text-[10px]">·</span>
            <span className="font-mono text-[10px] text-surface-500">
              {stance.total_votes.toLocaleString()} votes
            </span>
            {stance.topicCategory && (
              <>
                <span className="text-surface-600 text-[10px]">·</span>
                <span className="font-mono text-[10px] text-surface-500">{stance.topicCategory}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = 'challenges' | 'stances'

export function RivalryClient({ id1, id2 }: { id1: string; id2: string }) {
  const [data, setData] = useState<RivalryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('challenges')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/coalitions/rivalry?a=${id1}&b=${id2}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Failed to load rivalry')
      }
      const json = await res.json() as RivalryResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [id1, id2])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* ── Back link ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/coalitions"
            className="inline-flex items-center gap-2 text-sm font-mono text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Coalitions
          </Link>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30">
            <Swords className="h-5 w-5 text-against-400" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white">Rivalry</h1>
            <p className="font-mono text-sm text-surface-500 mt-0.5">
              Coalition head-to-head record & stance comparison
            </p>
          </div>
        </div>

        {loading && !data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-36 rounded-2xl" />
              <Skeleton className="h-36 rounded-2xl" />
            </div>
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        )}

        {error && !data && (
          <EmptyState
            icon={XCircle}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/30"
            title="Rivalry not found"
            description={error}
            actions={[{ label: 'Back to Coalitions', href: '/coalitions' }]}
          />
        )}

        {data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {/* ── Coalition cards ──────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-4">
                <CoalitionCard
                  coalition={data.coalitionA}
                  side="A"
                  wins={data.headToHead.aWins}
                  total={data.headToHead.total}
                />
                <CoalitionCard
                  coalition={data.coalitionB}
                  side="B"
                  wins={data.headToHead.bWins}
                  total={data.headToHead.total}
                />
              </div>

              {/* ── H2H Score ─────────────────────────────────────────── */}
              {data.headToHead.total > 0 ? (
                <ScoreDisplay
                  aWins={data.headToHead.aWins}
                  bWins={data.headToHead.bWins}
                  draws={data.headToHead.draws}
                  total={data.headToHead.total}
                  nameA={data.coalitionA.name}
                  nameB={data.coalitionB.name}
                />
              ) : (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 text-center">
                  <Swords className="h-8 w-8 text-surface-600 mx-auto mb-2" />
                  <p className="font-mono text-sm text-surface-500">
                    No clash history yet — these coalitions haven&apos;t faced off in a formal challenge.
                  </p>
                  <Link
                    href={`/coalitions/${id1}/challenges`}
                    className="inline-flex items-center gap-1 mt-3 text-xs font-mono text-for-400 hover:text-for-300"
                  >
                    Issue a challenge <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}

              {/* ── Stats strip ───────────────────────────────────────── */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center">
                  <p className="font-mono text-xl font-bold text-white">
                    {data.headToHead.total}
                  </p>
                  <p className="font-mono text-[10px] text-surface-500 uppercase tracking-wider mt-1">
                    Clashes
                  </p>
                </div>
                <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center">
                  <p className="font-mono text-xl font-bold text-purple">
                    {data.sharedStances.length}
                  </p>
                  <p className="font-mono text-[10px] text-surface-500 uppercase tracking-wider mt-1">
                    Shared Stances
                  </p>
                </div>
                <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center">
                  <p className="font-mono text-xl font-bold text-gold">
                    {data.memberOverlap}
                  </p>
                  <p className="font-mono text-[10px] text-surface-500 uppercase tracking-wider mt-1">
                    Shared Members
                  </p>
                </div>
              </div>

              {/* ── Similarity meter ──────────────────────────────────── */}
              {data.sharedStances.length > 0 && (
                <SimilarityMeter score={data.similarityScore} />
              )}

              {/* ── Tab selector ─────────────────────────────────────── */}
              {(data.headToHead.total > 0 || data.sharedStances.length > 0) && (
                <div className="flex rounded-xl bg-surface-200 p-1 gap-1">
                  <button
                    onClick={() => setTab('challenges')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-mono font-semibold transition-all',
                      tab === 'challenges'
                        ? 'bg-surface-50 text-white shadow-sm'
                        : 'text-surface-500 hover:text-surface-300',
                    )}
                  >
                    <Swords className="h-3.5 w-3.5" />
                    Clashes ({data.headToHead.total})
                  </button>
                  <button
                    onClick={() => setTab('stances')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-mono font-semibold transition-all',
                      tab === 'stances'
                        ? 'bg-surface-50 text-white shadow-sm'
                        : 'text-surface-500 hover:text-surface-300',
                    )}
                  >
                    <BarChart2 className="h-3.5 w-3.5" />
                    Stances ({data.sharedStances.length})
                  </button>
                </div>
              )}

              {/* ── Challenge history ──────────────────────────────────── */}
              <AnimatePresence mode="wait">
                {tab === 'challenges' && (
                  <motion.div
                    key="challenges"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="space-y-2"
                  >
                    {data.headToHead.challenges.length === 0 ? (
                      <EmptyState
                        icon={Swords}
                        iconColor="text-surface-500"
                        title="No challenges yet"
                        description="These coalitions haven't clashed in a formal debate challenge."
                        size="sm"
                      />
                    ) : (
                      data.headToHead.challenges.map((ch) => (
                        <ChallengeRow
                          key={ch.id}
                          challenge={ch}
                          idA={id1}
                          nameA={data.coalitionA.name}
                          nameB={data.coalitionB.name}
                        />
                      ))
                    )}
                  </motion.div>
                )}

                {tab === 'stances' && (
                  <motion.div
                    key="stances"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="space-y-2"
                  >
                    {data.sharedStances.length === 0 ? (
                      <EmptyState
                        icon={BarChart2}
                        iconColor="text-surface-500"
                        title="No shared stances"
                        description="Neither coalition has declared a stance on the same topic yet."
                        size="sm"
                      />
                    ) : (
                      <>
                        <div className="flex items-center gap-2 px-1 mb-1">
                          <span className="flex items-center gap-1 text-[10px] font-mono text-emerald">
                            <CheckCircle2 className="h-3 w-3" />
                            {data.sharedStances.filter((s) => s.agree).length} agree
                          </span>
                          <span className="text-surface-600 text-[10px]">·</span>
                          <span className="flex items-center gap-1 text-[10px] font-mono text-against-400">
                            <XCircle className="h-3 w-3" />
                            {data.sharedStances.filter((s) => !s.agree).length} disagree
                          </span>
                        </div>
                        {data.sharedStances.map((s) => (
                          <StanceRow
                            key={s.topicId}
                            stance={s}
                            nameA={data.coalitionA.name}
                            nameB={data.coalitionB.name}
                          />
                        ))}
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Quick actions ──────────────────────────────────────── */}
              <div className="pt-2 border-t border-surface-300 grid grid-cols-2 gap-3">
                <Link
                  href={`/coalitions/${id1}`}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-for-600/20 border border-for-600/30 text-xs font-mono font-semibold text-for-400 hover:bg-for-600/30 transition-all"
                >
                  <Shield className="h-3.5 w-3.5" />
                  {data.coalitionA.name.slice(0, 14)}
                </Link>
                <Link
                  href={`/coalitions/${id2}`}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-against-500/20 border border-against-500/30 text-xs font-mono font-semibold text-against-400 hover:bg-against-500/30 transition-all"
                >
                  <Shield className="h-3.5 w-3.5" />
                  {data.coalitionB.name.slice(0, 14)}
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
