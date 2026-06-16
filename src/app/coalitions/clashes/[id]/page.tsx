'use client'

/**
 * /coalitions/clashes/[id] — Coalition Clash Detail
 *
 * Full drill-down view of a single coalition challenge:
 *   • Both coalitions' stances and member counts
 *   • Topic context with live vote bar
 *   • Clout stake and winner declaration
 *   • Challenge timeline (issued → responded → resolved)
 *   • Top arguments contributed by each coalition's members
 *
 * Distinct from:
 *   /coalitions/clashes          — global list of all active/recent clashes
 *   /coalitions/[id]/challenges  — per-coalition challenge board (member view)
 *   /topic/[id]                  — full topic page
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  ExternalLink,
  Flame,
  Loader2,
  MessageSquare,
  Scale,
  Shield,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ClashDetail, ClashArgument, CoalitionSide } from '@/app/api/coalitions/clashes/[id]/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const STANCE_CONFIG = {
  for: { label: 'FOR', color: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/30', icon: ThumbsUp },
  against: { label: 'AGAINST', color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', icon: ThumbsDown },
  neutral: { label: 'NEUTRAL', color: 'text-surface-400', bg: 'bg-surface-600/20', border: 'border-surface-500/30', icon: Scale },
}

const STATUS_CONFIG = {
  pending:  { label: 'Awaiting Response', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: Clock },
  accepted: { label: 'Clash In Progress', color: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/30', icon: Flame },
  resolved: { label: 'Resolved', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: CheckCircle2 },
  declined: { label: 'Challenge Declined', color: 'text-surface-400', bg: 'bg-surface-600/20', border: 'border-surface-500/30', icon: X },
  expired:  { label: 'Challenge Expired', color: 'text-surface-400', bg: 'bg-surface-600/20', border: 'border-surface-500/30', icon: Clock },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StancePill({ stance }: { stance: 'for' | 'against' | 'neutral' | null }) {
  if (!stance) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-surface-600/20 border border-surface-500/30 text-surface-500">
      <Scale className="h-2.5 w-2.5" />
      TBD
    </span>
  )
  const cfg = STANCE_CONFIG[stance]
  const Icon = cfg.icon
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
      cfg.bg, cfg.border, cfg.color
    )}>
      <Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  )
}

function ArgumentCard({ arg }: { arg: ClashArgument }) {
  const isFor = arg.side === 'blue'
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'p-3 rounded-lg border transition-colors',
        isFor
          ? 'bg-for-500/5 border-for-500/20 hover:border-for-500/40'
          : 'bg-against-500/5 border-against-500/20 hover:border-against-500/40'
      )}
    >
      <div className="flex items-start gap-2.5">
        <Link href={`/profile/${arg.username}`} className="shrink-0 mt-0.5">
          <Avatar src={arg.avatarUrl} username={arg.username} size={24} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Link
              href={`/profile/${arg.username}`}
              className="text-xs font-semibold text-white/80 hover:text-white transition-colors truncate"
            >
              {arg.displayName ?? arg.username}
            </Link>
            <span className={cn(
              'shrink-0 text-[9px] font-mono font-bold px-1.5 py-px rounded-full border',
              isFor
                ? 'text-for-400 bg-for-500/10 border-for-500/30'
                : 'text-against-400 bg-against-500/10 border-against-500/30'
            )}>
              {isFor ? 'FOR' : 'AGAINST'}
            </span>
            {arg.aiGrade && (
              <span className="shrink-0 text-[9px] font-mono font-bold px-1.5 py-px rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400">
                {arg.aiGrade}
              </span>
            )}
          </div>
          <p className="text-xs text-surface-300 leading-relaxed line-clamp-3">{arg.content}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-[10px] text-surface-500">
              <ThumbsUp className="h-2.5 w-2.5" />
              {arg.upvotes}
            </span>
            <span className="text-[10px] text-surface-600">{relativeTime(arg.createdAt)}</span>
            {arg.sourceUrl && (
              <a
                href={arg.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-0.5 text-[10px] text-surface-500 hover:text-for-400 transition-colors"
              >
                <ExternalLink className="h-2.5 w-2.5" />
                source
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function CoalitionPanel({
  side,
  isChallenger,
  isWinner,
  label,
}: {
  side: CoalitionSide
  isChallenger: boolean
  isWinner: boolean
  label: 'Challenger' | 'Challenged'
}) {
  return (
    <div className={cn(
      'flex-1 rounded-xl border p-4 flex flex-col gap-3',
      isWinner
        ? 'bg-emerald-500/5 border-emerald-500/30'
        : 'bg-surface-800/50 border-surface-700/50'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className={cn(
              'text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border',
              isChallenger
                ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                : 'text-surface-400 bg-surface-700/30 border-surface-600/30'
            )}>
              {label}
            </span>
            {isWinner && (
              <span className="flex items-center gap-0.5 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                <Trophy className="h-2.5 w-2.5" />
                WINNER
              </span>
            )}
          </div>
          <Link
            href={`/coalitions/${side.id}`}
            className="font-bold text-white hover:text-for-300 transition-colors line-clamp-2 leading-tight"
          >
            {side.name}
          </Link>
        </div>
        <Shield className={cn(
          'h-5 w-5 shrink-0 mt-0.5',
          isWinner ? 'text-emerald-400' : 'text-surface-500'
        )} />
      </div>

      {/* Stance */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-surface-500">Stance:</span>
        <StancePill stance={side.stance} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="bg-surface-700/30 rounded-lg py-2 px-3">
          <div className="text-sm font-bold text-white">{side.memberCount.toLocaleString()}</div>
          <div className="text-[10px] text-surface-500 mt-0.5">Members</div>
        </div>
        <div className="bg-surface-700/30 rounded-lg py-2 px-3">
          <div className="text-sm font-bold text-emerald-400">{side.wins}W</div>
          <div className="text-[10px] text-surface-500 mt-0.5">{side.losses}L Record</div>
        </div>
      </div>

      {/* Participation */}
      {side.totalArguments > 0 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-surface-500 flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {side.totalArguments} argument{side.totalArguments !== 1 ? 's' : ''}
          </span>
          {side.participantCount > 0 && (
            <span className="text-surface-500 flex items-center gap-1">
              <Users className="h-3 w-3" />
              {side.participantCount} contributor{side.participantCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ClashDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [clash, setClash] = useState<ClashDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [argTab, setArgTab] = useState<'challenger' | 'challenged' | 'all'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/coalitions/clashes/${id}`)
      if (!res.ok) throw new Error('Clash not found')
      const data: ClashDetail = await res.json()
      setClash(data)
    } catch {
      setError('Could not load this clash.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-surface-900">
        <TopBar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-for-400" />
            <p className="text-sm text-surface-400">Loading clash details&hellip;</p>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (error || !clash) {
    return (
      <div className="flex flex-col h-screen bg-surface-900">
        <TopBar />
        <main className="flex-1 flex items-center justify-center px-4">
          <EmptyState
            icon={AlertCircle}
            title="Clash not found"
            description={error ?? 'This coalition challenge does not exist or has been removed.'}
            action={{ label: 'All Clashes', href: '/coalitions/clashes' }}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[clash.status]
  const StatusIcon = statusCfg.icon
  const bluePct = Math.round(clash.topic.bluePct)
  const redPct = 100 - bluePct
  const winnerIsChallenger = clash.winnerId === clash.challenger.id
  const winnerIsChallenged = clash.winnerId === clash.challenged.id

  const allArgs = [...clash.challenger.topArguments, ...clash.challenged.topArguments]
    .sort((a, b) => b.upvotes - a.upvotes)
  const displayedArgs =
    argTab === 'all' ? allArgs
    : argTab === 'challenger' ? clash.challenger.topArguments
    : clash.challenged.topArguments

  return (
    <div className="flex flex-col h-screen bg-surface-900">
      <TopBar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-24">

          {/* Back nav */}
          <div className="flex items-center gap-2 mb-4">
            <Link
              href="/coalitions/clashes"
              className="flex items-center gap-1.5 text-sm text-surface-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              All Clashes
            </Link>
            <span className="text-surface-700">/</span>
            <span className="text-sm text-surface-500">Clash Detail</span>
          </div>

          {/* Status banner */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl border mb-4 text-sm font-semibold',
              statusCfg.bg, statusCfg.border, statusCfg.color
            )}
          >
            <StatusIcon className="h-4 w-4 shrink-0" />
            {statusCfg.label}
            {clash.stakeClout > 0 && (
              <span className="ml-auto flex items-center gap-1 text-xs font-mono">
                <Coins className="h-3.5 w-3.5 text-yellow-400" />
                {clash.stakeClout.toLocaleString()} Clout at Stake
              </span>
            )}
          </motion.div>

          {/* Topic card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-surface-800/60 border border-surface-700/50 rounded-xl p-4 mb-4"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  {clash.topic.category && (
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-surface-500 bg-surface-700/40 px-2 py-0.5 rounded-full">
                      {clash.topic.category}
                    </span>
                  )}
                  <span className={cn(
                    'text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full',
                    clash.topic.status === 'active' ? 'text-for-400 bg-for-500/10' :
                    clash.topic.status === 'established' ? 'text-emerald-400 bg-emerald-500/10' :
                    'text-surface-400 bg-surface-700/30'
                  )}>
                    {clash.topic.status}
                  </span>
                </div>
                <p className="text-sm font-semibold text-white leading-snug">
                  {clash.topic.statement}
                </p>
              </div>
              <Link
                href={`/topic/${clash.topic.id}`}
                className="shrink-0 p-1.5 rounded-lg bg-surface-700/30 hover:bg-surface-700/60 text-surface-400 hover:text-for-400 transition-colors"
                title="View full topic"
              >
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>

            {/* Vote bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-surface-500">
                <span className="text-for-400">FOR {bluePct}%</span>
                <span className="text-surface-500">{clash.topic.totalVotes.toLocaleString()} votes</span>
                <span className="text-against-400">{redPct}% AGAINST</span>
              </div>
              <div className="h-2 rounded-full bg-surface-700 overflow-hidden flex">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${bluePct}%` }}
                  transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                  className="h-full bg-for-500 rounded-l-full"
                />
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${redPct}%` }}
                  transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                  className="h-full bg-against-500 rounded-r-full"
                />
              </div>
            </div>

            {/* Resolved side */}
            {clash.topic.resolvedSide && (
              <div className={cn(
                'mt-3 flex items-center gap-1.5 text-xs font-semibold',
                clash.topic.resolvedSide === 'blue' ? 'text-for-400' : 'text-against-400'
              )}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Resolved: {clash.topic.resolvedSide === 'blue' ? 'FOR passed' : 'AGAINST prevailed'}
              </div>
            )}
          </motion.div>

          {/* Coalition matchup */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-4"
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="h-px flex-1 bg-surface-700/50" />
              <div className="flex items-center gap-1.5 text-xs text-surface-500 font-mono uppercase tracking-wider">
                <Swords className="h-3.5 w-3.5 text-against-400" />
                Coalition Clash
              </div>
              <div className="h-px flex-1 bg-surface-700/50" />
            </div>
            <div className="flex gap-3">
              <CoalitionPanel
                side={clash.challenger}
                isChallenger
                isWinner={winnerIsChallenger}
                label="Challenger"
              />
              <div className="flex items-center justify-center text-surface-600 font-black text-lg">VS</div>
              <CoalitionPanel
                side={clash.challenged}
                isChallenger={false}
                isWinner={winnerIsChallenged}
                label="Challenged"
              />
            </div>
          </motion.div>

          {/* Challenger message */}
          {clash.message && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-amber-400">Challenge Message</span>
                <Link
                  href={`/profile/${clash.issuedBy.username}`}
                  className="ml-auto flex items-center gap-1.5 text-xs text-surface-400 hover:text-white transition-colors"
                >
                  <Avatar src={clash.issuedBy.avatarUrl} username={clash.issuedBy.username} size={16} />
                  {clash.issuedBy.displayName ?? clash.issuedBy.username}
                </Link>
              </div>
              <p className="text-sm text-surface-300 leading-relaxed italic">&ldquo;{clash.message}&rdquo;</p>
            </motion.div>
          )}

          {/* Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-surface-800/40 border border-surface-700/40 rounded-xl p-4 mb-4"
          >
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Timeline
            </h3>
            <ol className="relative border-l border-surface-700/50 ml-1.5 space-y-3">
              {/* Issued */}
              <li className="ml-4">
                <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-amber-500/70 border border-amber-500/30" />
                <p className="text-xs font-semibold text-white">Challenge Issued</p>
                <p className="text-[11px] text-surface-500 mt-0.5">
                  by{' '}
                  <Link href={`/profile/${clash.issuedBy.username}`} className="hover:text-white transition-colors">
                    {clash.issuedBy.displayName ?? clash.issuedBy.username}
                  </Link>
                  {' · '}
                  <span title={formatDate(clash.createdAt)}>{relativeTime(clash.createdAt)}</span>
                </p>
              </li>

              {/* Responded */}
              {clash.respondedAt ? (
                <li className="ml-4">
                  <div className={cn(
                    'absolute -left-1.5 w-3 h-3 rounded-full border',
                    clash.status === 'declined'
                      ? 'bg-against-500/70 border-against-500/30'
                      : 'bg-for-500/70 border-for-500/30'
                  )} />
                  <p className="text-xs font-semibold text-white">
                    {clash.status === 'declined' ? 'Challenge Declined' : 'Challenge Accepted'}
                  </p>
                  <p className="text-[11px] text-surface-500 mt-0.5" title={formatDate(clash.respondedAt)}>
                    {relativeTime(clash.respondedAt)}
                  </p>
                </li>
              ) : clash.status === 'pending' ? (
                <li className="ml-4 opacity-50">
                  <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-surface-600 border border-surface-500/30" />
                  <p className="text-xs text-surface-500">Awaiting response&hellip;</p>
                  <p className="text-[11px] text-surface-600 mt-0.5">
                    Expires {relativeTime(clash.expiresAt)}
                  </p>
                </li>
              ) : null}

              {/* Resolved */}
              {clash.resolvedAt ? (
                <li className="ml-4">
                  <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-emerald-500/70 border border-emerald-500/30" />
                  <p className="text-xs font-semibold text-white">
                    {clash.winnerName ? `${clash.winnerName} won` : 'Resolved'}
                  </p>
                  <p className="text-[11px] text-surface-500 mt-0.5" title={formatDate(clash.resolvedAt)}>
                    {relativeTime(clash.resolvedAt)}
                  </p>
                </li>
              ) : clash.status === 'accepted' ? (
                <li className="ml-4 opacity-50">
                  <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-surface-600 border border-surface-500/30" />
                  <p className="text-xs text-surface-500">Resolves when topic closes&hellip;</p>
                </li>
              ) : null}
            </ol>
          </motion.div>

          {/* Arguments section */}
          {allArgs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mb-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4 text-surface-400" />
                  Coalition Arguments
                </h3>
                <span className="text-xs text-surface-500">
                  {allArgs.length} top
                </span>
              </div>

              {/* Tab switcher */}
              <div className="flex gap-1 p-1 bg-surface-800/60 rounded-lg border border-surface-700/50 mb-3">
                {(['all', 'challenger', 'challenged'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setArgTab(tab)}
                    className={cn(
                      'flex-1 py-1.5 text-xs font-semibold rounded-md transition-all',
                      argTab === tab
                        ? 'bg-surface-700 text-white'
                        : 'text-surface-500 hover:text-surface-300'
                    )}
                  >
                    {tab === 'all'
                      ? 'All'
                      : tab === 'challenger'
                      ? clash.challenger.name
                      : clash.challenged.name}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={argTab}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-2"
                >
                  {displayedArgs.length === 0 ? (
                    <div className="py-6 text-center text-sm text-surface-500">
                      No arguments from this coalition yet
                    </div>
                  ) : (
                    displayedArgs.map(arg => (
                      <ArgumentCard key={arg.id} arg={arg} />
                    ))
                  )}
                </motion.div>
              </AnimatePresence>

              <Link
                href={`/topic/${clash.topic.id}/arguments`}
                className="mt-3 flex items-center justify-center gap-1.5 text-xs text-surface-500 hover:text-for-400 transition-colors py-2 border border-dashed border-surface-700/50 rounded-lg hover:border-for-500/30"
              >
                View all arguments on this topic
                <ArrowRight className="h-3 w-3" />
              </Link>
            </motion.div>
          )}

          {/* Empty arguments state */}
          {allArgs.length === 0 && clash.status === 'accepted' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="mb-4"
            >
              <EmptyState
                icon={MessageSquare}
                title="No coalition arguments yet"
                description="Neither coalition has contributed arguments to this topic. Members who argue here earn bonus influence."
                action={{ label: 'View Topic', href: `/topic/${clash.topic.id}/argue` }}
              />
            </motion.div>
          )}

          {/* Footer links */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-2 gap-2"
          >
            <Link
              href={`/coalitions/${clash.challenger.id}`}
              className="flex items-center gap-2 p-3 rounded-xl bg-surface-800/40 border border-surface-700/40 hover:border-surface-600/60 transition-colors group"
            >
              <Shield className="h-4 w-4 text-surface-500 group-hover:text-amber-400 transition-colors" />
              <div className="min-w-0">
                <div className="text-[9px] text-surface-600 uppercase tracking-wider">Challenger</div>
                <div className="text-xs font-semibold text-surface-300 group-hover:text-white transition-colors truncate">
                  {clash.challenger.name}
                </div>
              </div>
              <ArrowRight className="h-3 w-3 text-surface-600 ml-auto group-hover:text-surface-400 transition-colors" />
            </Link>
            <Link
              href={`/coalitions/${clash.challenged.id}`}
              className="flex items-center gap-2 p-3 rounded-xl bg-surface-800/40 border border-surface-700/40 hover:border-surface-600/60 transition-colors group"
            >
              <Shield className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors" />
              <div className="min-w-0">
                <div className="text-[9px] text-surface-600 uppercase tracking-wider">Challenged</div>
                <div className="text-xs font-semibold text-surface-300 group-hover:text-white transition-colors truncate">
                  {clash.challenged.name}
                </div>
              </div>
              <ArrowRight className="h-3 w-3 text-surface-600 ml-auto group-hover:text-surface-400 transition-colors" />
            </Link>
            <Link
              href={`/topic/${clash.topic.id}`}
              className="col-span-2 flex items-center gap-2 p-3 rounded-xl bg-surface-800/40 border border-surface-700/40 hover:border-for-500/30 transition-colors group"
            >
              <BarChart2 className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors" />
              <span className="text-xs font-semibold text-surface-300 group-hover:text-white transition-colors line-clamp-1 flex-1">
                {clash.topic.statement}
              </span>
              <ArrowRight className="h-3 w-3 text-surface-600 ml-auto group-hover:text-for-400 transition-colors" />
            </Link>
            <Link
              href="/coalitions/clashes"
              className="col-span-2 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-surface-700/50 text-xs text-surface-500 hover:text-surface-300 hover:border-surface-600/50 transition-colors"
            >
              <Swords className="h-3.5 w-3.5" />
              All Coalition Clashes
            </Link>
          </motion.div>

        </div>
      </main>
      <BottomNav />
    </div>
  )
}
