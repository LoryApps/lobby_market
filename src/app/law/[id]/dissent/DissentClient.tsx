'use client'

/**
 * /law/[id]/dissent — The Loyal Opposition
 *
 * Shows the dissenting voices after a law was established:
 * - How many citizens voted against and at what percentage
 * - Their strongest arguments
 * - Civic Veto challenges filed
 * - Amendment proposals (dissent via reform)
 * - The most prominent dissenters
 *
 * Distinct from /law/[id]/amendments (the voting UI for amendments)
 * and /law/[id]/reviews (qualitative ratings).
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Edit3,
  FileText,
  MessageSquare,
  RefreshCw,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  LawDissentData,
  DissentArgument,
  DissentVeto,
  DissentAmendment,
  DissentVoter,
} from '@/app/api/laws/[id]/dissent/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function futureTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  if (d > 0) return `${d}d left`
  return `${h}h left`
}

const GROUNDS_LABEL: Record<string, string> = {
  unconstitutional: 'Unconstitutional',
  ineffective: 'Ineffective',
  harmful: 'Harmful',
  outdated: 'Outdated',
  procedural: 'Procedural',
}

const GROUNDS_COLOR: Record<string, string> = {
  unconstitutional: 'text-against-400 bg-against-500/10 border-against-500/30',
  ineffective: 'text-gold bg-gold/10 border-gold/30',
  harmful: 'text-against-400 bg-against-500/10 border-against-500/30',
  outdated: 'text-surface-500 bg-surface-300/40 border-surface-400/40',
  procedural: 'text-purple bg-purple/10 border-purple/30',
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  sub,
  color = 'text-white',
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-surface-300 bg-surface-200 p-4">
      <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">{label}</span>
      <span className={cn('text-2xl font-mono font-bold', color)}>{value}</span>
      {sub && <span className="text-xs font-mono text-surface-500">{sub}</span>}
    </div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({ arg }: { arg: DissentArgument }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = arg.content.length > 240
  const display = isLong && !expanded ? arg.content.slice(0, 240) + '…' : arg.content

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-against-500/30 bg-against-500/5 p-4 space-y-3"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-against-500/20 border border-against-500/40">
          <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
        </div>
        <p className="flex-1 text-sm font-mono text-surface-700 leading-relaxed">
          {display}
        </p>
      </div>

      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" /> Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" /> Show more
            </>
          )}
        </button>
      )}

      <div className="flex items-center justify-between gap-3 pt-1 border-t border-against-500/20">
        <div className="flex items-center gap-2">
          {arg.author ? (
            <>
              <Avatar
                src={arg.author.avatar_url}
                username={arg.author.username}
                size="xs"
              />
              <Link
                href={`/profile/${arg.author.username}`}
                className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                {arg.author.display_name || arg.author.username}
              </Link>
            </>
          ) : (
            <span className="text-xs font-mono text-surface-600">Anonymous</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono text-against-400">
          <ThumbsUp className="h-3 w-3" />
          <span>{arg.upvotes.toLocaleString()}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Veto card ────────────────────────────────────────────────────────────────

function VetoCard({ veto }: { veto: DissentVeto }) {
  const groundsStyle =
    GROUNDS_COLOR[veto.grounds_type] ??
    'text-surface-500 bg-surface-300/40 border-surface-400/40'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-surface-300 bg-surface-200 p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-mono font-semibold text-white leading-snug">
            {veto.title}
          </h3>
          <p className="text-xs font-mono text-surface-500 mt-1 line-clamp-2">
            {veto.grounds}
          </p>
        </div>
        <span
          className={cn(
            'flex-shrink-0 text-xs font-mono px-2 py-0.5 rounded-full border',
            groundsStyle
          )}
        >
          {GROUNDS_LABEL[veto.grounds_type] ?? veto.grounds_type}
        </span>
      </div>

      {/* Signature progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-surface-500">
            {veto.signature_count.toLocaleString()} / {veto.target_signatures.toLocaleString()} signatures
          </span>
          <span className={cn(
            'font-semibold',
            veto.pct_complete >= 100 ? 'text-emerald' : 'text-against-400'
          )}>
            {veto.pct_complete}%
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-surface-300 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${veto.pct_complete}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className={cn(
              'h-full rounded-full',
              veto.pct_complete >= 100 ? 'bg-emerald' : 'bg-against-500'
            )}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2">
          {veto.challenger && (
            <>
              <Avatar
                src={veto.challenger.avatar_url}
                username={veto.challenger.username}
                size="xs"
              />
              <Link
                href={`/profile/${veto.challenger.username}`}
                className="text-surface-500 hover:text-white transition-colors"
              >
                {veto.challenger.display_name || veto.challenger.username}
              </Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'px-2 py-0.5 rounded-full border text-xs font-mono',
              veto.status === 'open'
                ? 'text-gold bg-gold/10 border-gold/30'
                : veto.status === 'succeeded'
                ? 'text-emerald bg-emerald/10 border-emerald/30'
                : 'text-surface-500 bg-surface-300/40 border-surface-400/40'
            )}
          >
            {veto.status === 'open' ? futureTime(veto.closes_at) : veto.status}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Amendment card ───────────────────────────────────────────────────────────

function AmendmentCard({ amendment }: { amendment: DissentAmendment }) {
  const totalVotes = amendment.for_count + amendment.against_count
  const forPct = totalVotes > 0 ? Math.round((amendment.for_count / totalVotes) * 100) : 50

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-surface-300 bg-surface-200 p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Edit3 className="h-3.5 w-3.5 text-purple flex-shrink-0" />
            <h3 className="text-sm font-mono font-semibold text-white leading-snug truncate">
              {amendment.title}
            </h3>
          </div>
          <p className="text-xs font-mono text-surface-500 line-clamp-2">{amendment.body}</p>
        </div>
        <span
          className={cn(
            'flex-shrink-0 text-xs font-mono px-2 py-0.5 rounded-full border',
            amendment.status === 'ratified'
              ? 'text-emerald bg-emerald/10 border-emerald/30'
              : amendment.status === 'rejected'
              ? 'text-against-400 bg-against-500/10 border-against-500/30'
              : 'text-gold bg-gold/10 border-gold/30'
          )}
        >
          {amendment.status}
        </span>
      </div>

      {totalVotes > 0 && (
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded-full bg-surface-300 overflow-hidden flex">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${forPct}%` }}
              transition={{ duration: 0.6 }}
              className="h-full bg-for-500 rounded-l-full"
            />
            <motion.div
              initial={{ width: '100%' }}
              animate={{ width: `${100 - forPct}%` }}
              transition={{ duration: 0.6 }}
              className="h-full bg-against-500 rounded-r-full"
            />
          </div>
          <div className="flex justify-between text-xs font-mono text-surface-500">
            <span className="text-for-400">{forPct}% For</span>
            <span className="text-against-400">{100 - forPct}% Against</span>
          </div>
        </div>
      )}

      {amendment.proposer && (
        <div className="flex items-center gap-2 pt-1 border-t border-surface-300">
          <Avatar
            src={amendment.proposer.avatar_url}
            username={amendment.proposer.username}
            size="xs"
          />
          <Link
            href={`/profile/${amendment.proposer.username}`}
            className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            {amendment.proposer.display_name || amendment.proposer.username}
          </Link>
          <span className="text-xs font-mono text-surface-600 ml-auto">
            {relTime(amendment.created_at)}
          </span>
        </div>
      )}
    </motion.div>
  )
}

// ─── Dissenter row ────────────────────────────────────────────────────────────

function DissenterRow({ voter }: { voter: DissentVoter }) {
  const ROLE_LABEL: Record<string, string> = {
    person: 'Citizen',
    debator: 'Debator',
    troll_catcher: 'Troll Catcher',
    elder: 'Elder',
  }

  return (
    <Link
      href={`/profile/${voter.username}`}
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-200 transition-colors group"
    >
      <Avatar src={voter.avatar_url} username={voter.username} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-medium text-white group-hover:text-against-400 transition-colors truncate">
            {voter.display_name || voter.username}
          </span>
          <span className="text-xs font-mono text-surface-500">
            {ROLE_LABEL[voter.role] ?? voter.role}
          </span>
        </div>
        {voter.reason && (
          <p className="text-xs font-mono text-surface-500 truncate mt-0.5">
            &quot;{voter.reason}&quot;
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 text-xs font-mono text-against-400 flex-shrink-0">
        <Zap className="h-3 w-3" />
        <span>{voter.clout.toLocaleString()}</span>
      </div>
    </Link>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function DissentSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DissentClient({ lawId }: { lawId: string }) {
  const params = useParams<{ id: string }>()
  const id = lawId || params.id

  const [data, setData] = useState<LawDissentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'arguments' | 'vetoes' | 'amendments' | 'voices'>(
    'arguments'
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${id}/dissent`)
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      setData(json as LawDissentData)
    } catch {
      setError('Could not load dissent data.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const TABS = [
    {
      id: 'arguments' as const,
      label: 'Arguments',
      icon: MessageSquare,
      count: data?.topArguments.length ?? 0,
    },
    {
      id: 'vetoes' as const,
      label: 'Civic Vetoes',
      icon: Shield,
      count: data?.stats.veto_count ?? 0,
    },
    {
      id: 'amendments' as const,
      label: 'Amendments',
      icon: Edit3,
      count: data?.stats.amendment_count ?? 0,
    },
    {
      id: 'voices' as const,
      label: 'Voices',
      icon: Users,
      count: data?.topDissenters.length ?? 0,
    },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-8 space-y-6">
        {/* ── Back link + header ─────────────────────────────────────────── */}
        <div className="space-y-4">
          {data && (
            <Link
              href={`/law/${id}`}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Law
            </Link>
          )}

          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30">
              <ThumbsDown className="h-5 w-5 text-against-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Loyal Opposition
              </h1>
              {data && (
                <p className="text-sm font-mono text-surface-500 mt-0.5 line-clamp-2">
                  {data.law.statement}
                </p>
              )}
            </div>
          </div>
        </div>

        {loading && <DissentSkeleton />}

        {error && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-against-400" />
            <p className="text-sm font-mono text-surface-500">{error}</p>
            <button
              onClick={load}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-xs font-mono bg-surface-200 hover:bg-surface-300 text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        )}

        {data && !loading && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* ── Stats grid ──────────────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatTile
                  label="Against"
                  value={`${data.stats.against_pct}%`}
                  sub={`${data.stats.against_votes.toLocaleString()} votes`}
                  color="text-against-400"
                />
                <StatTile
                  label="For"
                  value={`${100 - data.stats.against_pct}%`}
                  sub={`${data.stats.for_votes.toLocaleString()} votes`}
                  color="text-for-400"
                />
                <StatTile
                  label="Veto Challenges"
                  value={data.stats.veto_count}
                  sub={
                    data.stats.veto_count > 0
                      ? `Peak: ${data.stats.top_veto_pct}%`
                      : 'None filed'
                  }
                  color={data.stats.veto_count > 0 ? 'text-against-400' : 'text-surface-500'}
                />
                <StatTile
                  label="Amendments"
                  value={data.stats.amendment_count}
                  sub={data.stats.amendment_count > 0 ? 'Proposed' : 'None yet'}
                  color={data.stats.amendment_count > 0 ? 'text-purple' : 'text-surface-500'}
                />
              </div>

              {/* ── Dissent bar ──────────────────────────────────────────── */}
              <div className="rounded-xl border border-surface-300 bg-surface-200 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-for-400">
                    <ThumbsUp className="h-3.5 w-3.5" />
                    FOR — {100 - data.stats.against_pct}%
                  </span>
                  <span className="flex items-center gap-1.5 text-against-400">
                    AGAINST — {data.stats.against_pct}%
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="h-3 w-full rounded-full overflow-hidden flex">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${100 - data.stats.against_pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full bg-for-500"
                  />
                  <motion.div
                    initial={{ width: '100%' }}
                    animate={{ width: `${data.stats.against_pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full bg-against-500"
                  />
                </div>
                <p className="text-xs font-mono text-surface-500">
                  {data.stats.against_votes.toLocaleString()} citizens voted against this law.
                  {data.stats.against_pct >= 40
                    ? ' A significant minority — their voices matter.'
                    : ' A smaller minority, but dissent is democratic.'}
                </p>
              </div>

              {/* ── Tabs ────────────────────────────────────────────────── */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex-shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-mono transition-colors border',
                      activeTab === tab.id
                        ? 'bg-against-500/20 text-against-300 border-against-500/40'
                        : 'bg-surface-200 text-surface-500 hover:text-white border-surface-300'
                    )}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                    {tab.count > 0 && (
                      <span className="text-[10px] px-1 rounded bg-surface-300 text-surface-600">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* ── Tab content ──────────────────────────────────────────── */}
              <AnimatePresence mode="wait">
                {activeTab === 'arguments' && (
                  <motion.div
                    key="args"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="space-y-3"
                  >
                    {data.topArguments.length === 0 ? (
                      <EmptyState
                        icon={MessageSquare}
                        title="No AGAINST arguments"
                        description="No dissenting arguments were filed during the original debate."
                      />
                    ) : (
                      data.topArguments.map((arg) => (
                        <ArgumentCard key={arg.id} arg={arg} />
                      ))
                    )}
                    {data.topArguments.length > 0 && (
                      <Link
                        href={`/topic/${data.law.topic_id}/arguments?side=against`}
                        className="flex items-center justify-center gap-1.5 w-full h-9 rounded-lg border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
                      >
                        View all AGAINST arguments
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </motion.div>
                )}

                {activeTab === 'vetoes' && (
                  <motion.div
                    key="vetoes"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="space-y-3"
                  >
                    {data.vetoes.length === 0 ? (
                      <EmptyState
                        icon={Shield}
                        title="No civic vetoes filed"
                        description="No citizen has challenged this law through the civic veto process yet."
                        action={
                          <Link
                            href="/civic-vetoes"
                            className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-xs font-mono bg-against-500/20 text-against-300 hover:bg-against-500/30 transition-colors border border-against-500/40"
                          >
                            <Shield className="h-3.5 w-3.5" /> File a Civic Veto
                          </Link>
                        }
                      />
                    ) : (
                      <>
                        {data.vetoes.map((veto) => (
                          <VetoCard key={veto.id} veto={veto} />
                        ))}
                        <Link
                          href="/civic-vetoes"
                          className="flex items-center justify-center gap-1.5 w-full h-9 rounded-lg border border-against-500/30 text-xs font-mono text-against-400 hover:bg-against-500/10 transition-colors"
                        >
                          <Shield className="h-3.5 w-3.5" /> View all civic vetoes
                        </Link>
                      </>
                    )}
                  </motion.div>
                )}

                {activeTab === 'amendments' && (
                  <motion.div
                    key="amends"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="space-y-3"
                  >
                    {data.amendments.length === 0 ? (
                      <EmptyState
                        icon={Edit3}
                        title="No amendments proposed"
                        description="No one has proposed changes to this law through the amendment process yet."
                        action={
                          <Link
                            href={`/law/${id}/amendments`}
                            className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-xs font-mono bg-purple/20 text-purple hover:bg-purple/30 transition-colors border border-purple/40"
                          >
                            <Edit3 className="h-3.5 w-3.5" /> Propose an Amendment
                          </Link>
                        }
                      />
                    ) : (
                      <>
                        {data.amendments.map((amendment) => (
                          <AmendmentCard key={amendment.id} amendment={amendment} />
                        ))}
                        <Link
                          href={`/law/${id}/amendments`}
                          className="flex items-center justify-center gap-1.5 w-full h-9 rounded-lg border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
                        >
                          View all amendments
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </>
                    )}
                  </motion.div>
                )}

                {activeTab === 'voices' && (
                  <motion.div
                    key="voices"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="rounded-xl border border-surface-300 bg-surface-200 divide-y divide-surface-300 overflow-hidden"
                  >
                    {data.topDissenters.length === 0 ? (
                      <div className="p-6">
                        <EmptyState
                          icon={Users}
                          title="No prominent dissenters"
                          description="Not enough voter profile data available."
                        />
                      </div>
                    ) : (
                      data.topDissenters.map((voter) => (
                        <DissenterRow key={voter.id} voter={voter} />
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Footer links ─────────────────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Link
                  href={`/law/${id}/amendments`}
                  className="flex items-center justify-between gap-3 p-4 rounded-xl border border-surface-300 bg-surface-200 hover:bg-surface-300 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-purple/10 border border-purple/30">
                      <Edit3 className="h-4 w-4 text-purple" />
                    </div>
                    <div>
                      <p className="text-sm font-mono font-medium text-white">Amendment Chamber</p>
                      <p className="text-xs font-mono text-surface-500">Vote on proposed changes</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors" />
                </Link>

                <Link
                  href={`/topic/${data.law.topic_id}`}
                  className="flex items-center justify-between gap-3 p-4 rounded-xl border border-surface-300 bg-surface-200 hover:bg-surface-300 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-for-500/10 border border-for-500/30">
                      <FileText className="h-4 w-4 text-for-400" />
                    </div>
                    <div>
                      <p className="text-sm font-mono font-medium text-white">Original Debate</p>
                      <p className="text-xs font-mono text-surface-500">See all votes &amp; arguments</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors" />
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
