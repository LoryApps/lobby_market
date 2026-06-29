'use client'

/**
 * /topic/[id]/continuations — Civic Chain Continuations
 *
 * Shows all community-proposed continuations for this topic — the "…but/and"
 * statements that get boosted, endorsed, and voted into the next link of the
 * civic debate chain.
 *
 * Distinct from:
 *   /continuations    — platform-wide continuation discovery hub
 *   /chains           — full chain browser (topic sequence history)
 *   /topic/[id]/chain-history — shows what THIS topic is a continuation of
 *
 * Status flow: pending → finalist → winner (becomes the next topic in the chain)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  ChevronRight,
  Clock,
  GitBranch,
  Link2,
  Plus,
  RefreshCw,
  ThumbsUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContinuationAuthor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string | null
}

interface Continuation {
  id: string
  topic_id: string
  author_id: string
  text: string
  connector: 'but' | 'and'
  boost_count: number
  endorsement_count: number
  vote_count: number
  status: 'pending' | 'finalist' | 'winner'
  created_at: string
  author: ContinuationAuthor | null
}

interface Props {
  topicId: string
  statement: string
  category: string | null
  status: string
  bluePct: number
  totalVotes: number
  windowEndsAt: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  continued: 'active',
  failed: 'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  continued: 'Continued',
  failed: 'Failed',
}

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

function countdownLabel(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Window closed'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h remaining`
  if (h > 0) return `${h}h ${m}m remaining`
  return `${m}m remaining`
}

const CONTINUATION_STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string; border: string }
> = {
  pending: {
    label: 'Pending',
    icon: ThumbsUp,
    color: 'text-surface-400',
    bg: 'bg-surface-400/10',
    border: 'border-surface-400/20',
  },
  finalist: {
    label: 'Finalist',
    icon: Award,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
  },
  winner: {
    label: 'Winner',
    icon: Trophy,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
  },
}

// ─── Continuation Card ─────────────────────────────────────────────────────────

interface ContCardProps {
  cont: Continuation
  rank: number
  statement: string
}

function ContCard({ cont, rank, statement }: ContCardProps) {
  const cfg = CONTINUATION_STATUS_CONFIG[cont.status] ?? CONTINUATION_STATUS_CONFIG.pending
  const Icon = cfg.icon

  const isWinner = cont.status === 'winner'
  const isFinalist = cont.status === 'finalist'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04 }}
      className={cn(
        'rounded-2xl border p-4 transition-all',
        isWinner
          ? 'border-emerald/40 bg-emerald/5'
          : isFinalist
          ? 'border-gold/30 bg-gold/5'
          : 'border-surface-300 bg-surface-100',
      )}
    >
      {/* Rank + status badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center justify-center h-6 w-6 rounded-lg text-xs font-mono font-bold flex-shrink-0',
              isWinner
                ? 'bg-emerald/20 text-emerald'
                : isFinalist
                ? 'bg-gold/20 text-gold'
                : 'bg-surface-300 text-surface-500',
            )}
          >
            #{rank + 1}
          </span>

          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold',
              cfg.bg,
              cfg.border,
              'border',
              cfg.color,
            )}
          >
            <Icon className="h-3 w-3" />
            {cfg.label}
          </span>
        </div>

        {/* Boost count */}
        <div className="flex items-center gap-1 text-surface-400">
          <Zap className="h-3.5 w-3.5" />
          <span className="font-mono text-xs font-semibold">{cont.boost_count}</span>
          <span className="font-mono text-[10px] text-surface-500">boosts</span>
        </div>
      </div>

      {/* Continuation text */}
      <div className="mb-3 pl-1">
        <p className="font-mono text-[10px] text-surface-500 mb-0.5 uppercase tracking-widest">
          …{cont.connector}
        </p>
        <p className="font-mono text-sm text-white font-semibold leading-snug">
          {cont.text}
        </p>
        {/* Show the full chain preview */}
        <p className="font-mono text-[10px] text-surface-600 mt-1 line-clamp-1 italic">
          &ldquo;{statement}&rdquo; …{cont.connector} {cont.text}
        </p>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 mb-3">
        {cont.endorsement_count > 0 && (
          <div className="flex items-center gap-1 text-surface-500">
            <Award className="h-3 w-3" />
            <span className="font-mono text-[10px]">{cont.endorsement_count} endorsements</span>
          </div>
        )}
        {cont.vote_count > 0 && (
          <div className="flex items-center gap-1 text-surface-500">
            <BarChart2 className="h-3 w-3" />
            <span className="font-mono text-[10px]">{cont.vote_count} votes</span>
          </div>
        )}
      </div>

      {/* Author + date */}
      <div className="flex items-center justify-between">
        {cont.author ? (
          <Link
            href={`/profile/${cont.author.username}`}
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
          >
            <Avatar
              src={cont.author.avatar_url}
              fallback={cont.author.display_name ?? cont.author.username ?? '?'}
              size="xs"
            />
            <span className="font-mono text-[10px] text-surface-500">
              <span className="text-surface-400 font-semibold">@{cont.author.username}</span>
            </span>
          </Link>
        ) : (
          <span className="font-mono text-[10px] text-surface-600">Anonymous</span>
        )}
        <div className="flex items-center gap-1 text-surface-600">
          <Clock className="h-3 w-3" />
          <span className="font-mono text-[10px]">{relativeTime(cont.created_at)}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function ContinuationsLoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-32 w-full rounded-2xl" />
      ))}
    </div>
  )
}

// ─── Main Client ──────────────────────────────────────────────────────────────

export function ContinuationsClient({
  topicId,
  statement,
  category,
  status,
  bluePct,
  totalVotes,
  windowEndsAt,
}: Props) {
  const [continuations, setContinuations] = useState<Continuation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct
  const isContinued = status === 'continued'
  const windowOpen = isContinued && windowEndsAt != null && new Date(windowEndsAt).getTime() > Date.now()

  const fetchContinuations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/continuations`)
      if (!res.ok) throw new Error('Failed to load continuations')
      const data: { continuations: Continuation[] } = await res.json()
      setContinuations(data.continuations ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { fetchContinuations() }, [fetchContinuations])

  const winners = continuations.filter((c) => c.status === 'winner')
  const finalists = continuations.filter((c) => c.status === 'finalist')
  const pending = continuations.filter((c) => c.status === 'pending')

  return (
    <div className="flex flex-col min-h-screen bg-surface-900 text-white">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24">
        {/* Back navigation */}
        <Link
          href={`/topic/${topicId}`}
          className="inline-flex items-center gap-1.5 text-surface-500 hover:text-surface-300 transition-colors mb-5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="font-mono text-xs">Back to debate</span>
        </Link>

        {/* Topic header */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant={STATUS_BADGE[status] ?? 'proposed'}>
              {STATUS_LABEL[status] ?? status}
            </Badge>
            {category && <Badge variant="person">{category}</Badge>}
            <div className="flex items-center gap-1.5 ml-auto">
              <GitBranch className="h-3.5 w-3.5 text-purple" />
              <span className="font-mono text-xs font-bold text-purple uppercase tracking-widest">
                Continuations
              </span>
            </div>
          </div>

          <h1 className="font-mono text-lg font-bold text-white leading-snug mb-2">
            {statement}
          </h1>

          {/* Community vote summary */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-1.5 w-24 rounded-full overflow-hidden">
              <div className="bg-for-500" style={{ width: `${forPct}%` }} />
              <div className="bg-against-500" style={{ width: `${againstPct}%` }} />
            </div>
            <span className="font-mono text-[10px] text-surface-500">
              {forPct}% For · {againstPct}% Against ·{' '}
              {(totalVotes ?? 0).toLocaleString()} votes
            </span>
          </div>

          {/* Continuation window banner */}
          {isContinued && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'rounded-xl border p-3 flex items-center gap-3',
                windowOpen
                  ? 'border-purple/40 bg-purple/5'
                  : 'border-surface-400/30 bg-surface-100',
              )}
            >
              <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0',
                windowOpen ? 'bg-purple/20' : 'bg-surface-300/30')}>
                <Clock className={cn('h-4 w-4', windowOpen ? 'text-purple' : 'text-surface-500')} />
              </div>
              <div className="min-w-0">
                <p className={cn('font-mono text-xs font-semibold', windowOpen ? 'text-purple' : 'text-surface-400')}>
                  {windowOpen ? 'Continuation window is open' : 'Continuation window closed'}
                </p>
                {windowEndsAt && (
                  <p className="font-mono text-[10px] text-surface-500">
                    {windowOpen ? countdownLabel(windowEndsAt) : `Ended ${relativeTime(windowEndsAt)}`}
                  </p>
                )}
              </div>
              {windowOpen && (
                <Link
                  href="/continuations"
                  className="ml-auto inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-purple hover:text-purple/80 transition-colors flex-shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Propose
                </Link>
              )}
            </motion.div>
          )}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ContinuationsLoadingSkeleton />
            </motion.div>
          )}

          {!loading && error && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl bg-against-500/10 border border-against-500/30 p-4 text-center"
            >
              <p className="font-mono text-sm text-against-300 mb-3">{error}</p>
              <button
                onClick={fetchContinuations}
                className="inline-flex items-center gap-2 font-mono text-xs text-surface-400 hover:text-white transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Try again
              </button>
            </motion.div>
          )}

          {!loading && !error && continuations.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-16 text-center gap-4"
            >
              <div className="h-16 w-16 rounded-2xl bg-surface-100 border border-surface-300 flex items-center justify-center">
                <GitBranch className="h-7 w-7 text-surface-500" />
              </div>
              <div>
                <p className="font-mono text-sm font-semibold text-surface-300 mb-1">
                  No continuations yet
                </p>
                <p className="font-mono text-xs text-surface-500 max-w-xs">
                  {isContinued && windowOpen
                    ? 'The continuation window is open. Debators can propose what debate comes next.'
                    : 'This debate hasn\'t entered the continuation phase yet — or no proposals have been made.'}
                </p>
              </div>
              {isContinued && windowOpen && (
                <Link
                  href="/continuations"
                  className="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl font-mono text-xs font-semibold bg-purple/20 border border-purple/40 text-purple hover:bg-purple/30 transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Propose a continuation
                </Link>
              )}
              {!isContinued && (
                <Link
                  href="/continuations"
                  className="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl font-mono text-xs font-semibold border border-surface-400 text-surface-300 hover:text-white hover:border-surface-300 transition-all"
                >
                  Browse all continuations
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </motion.div>
          )}

          {!loading && !error && continuations.length > 0 && (
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Summary bar */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-surface-300 bg-surface-100 p-4 mb-5 flex items-center gap-4"
              >
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-purple" />
                  <span className="font-mono text-xs font-bold text-purple">
                    {continuations.length} proposal{continuations.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {winners.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5 text-emerald" />
                    <span className="font-mono text-xs text-emerald">{winners.length} winner{winners.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
                {finalists.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5 text-gold" />
                    <span className="font-mono text-xs text-gold">{finalists.length} finalist{finalists.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
                <button
                  onClick={fetchContinuations}
                  className="ml-auto flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-surface-300 transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </button>
              </motion.div>

              {/* Winner(s) */}
              {winners.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <Trophy className="h-3.5 w-3.5 text-emerald" />
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-emerald">
                      Winner{winners.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {winners.map((c, i) => (
                      <ContCard key={c.id} cont={c} rank={i} statement={statement} />
                    ))}
                  </div>
                </div>
              )}

              {/* Finalists */}
              {finalists.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <Award className="h-3.5 w-3.5 text-gold" />
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-gold">
                      Finalists
                    </span>
                  </div>
                  <div className="space-y-3">
                    {finalists.map((c, i) => (
                      <ContCard key={c.id} cont={c} rank={i + winners.length} statement={statement} />
                    ))}
                  </div>
                </div>
              )}

              {/* Pending proposals */}
              {pending.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <ThumbsUp className="h-3.5 w-3.5 text-surface-400" />
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-surface-400">
                      Pending ({pending.length})
                    </span>
                  </div>
                  <div className="space-y-3">
                    {pending.map((c, i) => (
                      <ContCard
                        key={c.id}
                        cont={c}
                        rank={i + winners.length + finalists.length}
                        statement={statement}
                      />
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation links */}
        {!loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-2 gap-2 mt-6"
          >
            {[
              { href: `/topic/${topicId}/timeline`, icon: Clock, label: 'Timeline', desc: 'Debate history' },
              { href: `/topic/${topicId}/recap`, icon: BarChart2, label: 'Recap', desc: 'Debate summary' },
              { href: `/chains`, icon: Link2, label: 'Chains', desc: 'Full chain browser' },
              { href: `/continuations`, icon: GitBranch, label: 'All Continuations', desc: 'Platform-wide proposals' },
            ].map(({ href, icon: Icon, label, desc }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-all"
              >
                <Icon className="h-4 w-4 text-surface-400 flex-shrink-0" />
                <div>
                  <p className="font-mono text-xs font-semibold text-surface-200">{label}</p>
                  <p className="font-mono text-[10px] text-surface-500">{desc}</p>
                </div>
                <ChevronRight className="h-3 w-3 text-surface-600 ml-auto flex-shrink-0" />
              </Link>
            ))}
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
