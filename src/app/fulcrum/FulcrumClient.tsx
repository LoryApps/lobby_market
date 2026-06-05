'use client'

/**
 * /fulcrum — The Civic Fulcrum
 *
 * A fulcrum is the pivot point on a lever — the single place where balance
 * is maintained and where the slightest shift tips everything.
 *
 * These are Lobby Market's most balanced debates: topics where FOR and AGAINST
 * are genuinely deadlocked near 50/50 with real votes and real arguments on
 * both sides. Each card surfaces the most compelling argument from each side,
 * letting users see what's holding the balance.
 *
 * The Fulcrum Score = proximity-to-50/50 × log(vote_volume)
 *
 * Distinct from:
 *   /schism         — deepest ideological divides (argument-weighted, not vote-%)
 *   /tipping-point  — near the 75%/25% consensus threshold (not 50%)
 *   /flashpoint     — the single hottest contested topic
 *   /deadlock       — stuck topics with no momentum (the Fulcrum is alive)
 *   /battleground   — approaching the vote threshold (different metric)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Gavel,
  Info,
  MessageSquare,
  Quote,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Trophy,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { FulcrumResponse, FulcrumTopic, FulcrumArgument } from '@/app/api/fulcrum/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'bg-gold/10 text-gold border-gold/30',
  Politics:    'bg-for-500/10 text-for-400 border-for-500/30',
  Technology:  'bg-purple/10 text-purple border-purple/30',
  Science:     'bg-emerald/10 text-emerald border-emerald/30',
  Ethics:      'bg-for-300/10 text-for-300 border-for-300/30',
  Philosophy:  'bg-purple/10 text-purple border-purple/30',
  Culture:     'bg-against-400/10 text-against-300 border-against-400/30',
  Health:      'bg-emerald/10 text-emerald border-emerald/30',
  Environment: 'bg-emerald/10 text-emerald border-emerald/30',
  Education:   'bg-gold/10 text-gold border-gold/30',
  Other:       'bg-surface-400/10 text-surface-400 border-surface-400/30',
}

function categoryClass(cat: string | null) {
  return cat ? (CATEGORY_COLORS[cat] ?? 'bg-surface-300 text-surface-400 border-surface-400') : 'bg-surface-300 text-surface-400 border-surface-400'
}

function fmtVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (h < 1) return `${Math.floor(diff / 60_000)}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

function timeLeft(iso: string | null): string | null {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'ended'
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (h < 1) return `${Math.floor(diff / 60_000)}m left`
  if (h < 24) return `${h}h left`
  return `${d}d left`
}

function gradeColor(grade: string | null): string {
  if (!grade) return 'text-surface-500'
  if (grade.startsWith('A')) return 'text-emerald'
  if (grade.startsWith('B')) return 'text-for-400'
  if (grade.startsWith('C')) return 'text-gold'
  return 'text-against-400'
}

// ─── Balance Meter ────────────────────────────────────────────────────────────

function BalanceMeter({ bluePct }: { bluePct: number }) {
  const redPct = 100 - bluePct
  const deviation = Math.abs(bluePct - 50)
  // 0 = perfect balance (gold), higher = more tilted (surface)
  const balanceLabel =
    deviation <= 3 ? 'Perfect balance' :
    deviation <= 7 ? 'Near-perfect' :
    deviation <= 12 ? 'Slight tilt' :
    'Tilted'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-for-400 font-semibold">{bluePct.toFixed(1)}% FOR</span>
        <span className={cn(
          'text-[10px] font-mono px-1.5 py-0.5 rounded',
          deviation <= 3 ? 'bg-gold/10 text-gold' :
          deviation <= 7 ? 'bg-gold/10 text-gold/70' :
          'bg-surface-300 text-surface-500'
        )}>
          {balanceLabel}
        </span>
        <span className="text-against-400 font-semibold">{redPct.toFixed(1)}% AGAINST</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden bg-surface-300 flex">
        <motion.div
          className="bg-for-500 h-full"
          initial={{ width: '50%' }}
          animate={{ width: `${bluePct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        <motion.div
          className="bg-against-500 h-full"
          initial={{ width: '50%' }}
          animate={{ width: `${redPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      {/* Center tick */}
      <div className="relative h-1">
        <div className="absolute left-1/2 -translate-x-px top-0 w-0.5 h-1 bg-gold/60 rounded-full" />
      </div>
    </div>
  )
}

// ─── Argument Card ────────────────────────────────────────────────────────────

function ArgCard({
  arg,
  side,
  topicId,
}: {
  arg: FulcrumArgument | null
  side: 'blue' | 'red'
  topicId: string
}) {
  const isFor = side === 'blue'

  if (!arg) {
    return (
      <div className={cn(
        'rounded-xl border p-4 flex flex-col items-center justify-center gap-2 text-center h-full min-h-[120px]',
        isFor
          ? 'border-for-800/40 bg-for-950/20'
          : 'border-against-800/40 bg-against-950/20'
      )}>
        <MessageSquare className="h-5 w-5 text-surface-500" />
        <p className="text-xs font-mono text-surface-500">
          No {isFor ? 'FOR' : 'AGAINST'} argument yet
        </p>
        <Link
          href={`/topic/${topicId}/argue`}
          className={cn(
            'text-[11px] font-mono font-medium underline underline-offset-2',
            isFor ? 'text-for-400 hover:text-for-300' : 'text-against-400 hover:text-against-300'
          )}
        >
          Be the first
        </Link>
      </div>
    )
  }

  return (
    <div className={cn(
      'rounded-xl border p-4 flex flex-col gap-3 h-full',
      isFor
        ? 'border-for-800/40 bg-for-950/20'
        : 'border-against-800/40 bg-against-950/20'
    )}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className={cn(
          'flex items-center gap-1 text-[11px] font-mono font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full',
          isFor
            ? 'bg-for-500/10 text-for-400 border border-for-500/20'
            : 'bg-against-500/10 text-against-400 border border-against-500/20'
        )}>
          {isFor ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
          {isFor ? 'FOR' : 'AGAINST'}
        </div>
        {arg.ai_grade && (
          <span className={cn('text-[11px] font-mono font-bold', gradeColor(arg.ai_grade))}>
            {arg.ai_grade}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1 text-[11px] font-mono text-surface-500">
          <Trophy className="h-3 w-3" />
          {arg.upvotes.toLocaleString()}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        <Quote className={cn('h-3.5 w-3.5 mb-1 opacity-40', isFor ? 'text-for-400' : 'text-against-400')} />
        <p className={cn(
          'text-sm font-mono leading-relaxed line-clamp-4',
          isFor ? 'text-for-200' : 'text-against-200'
        )}>
          {arg.content}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[11px] font-mono text-surface-500">
        <span className="truncate max-w-[100px]">
          @{arg.author_username}
        </span>
        <span>{relTime(arg.created_at)}</span>
      </div>
    </div>
  )
}

// ─── Topic Card ───────────────────────────────────────────────────────────────

function FulcrumCard({ topic, rank }: { topic: FulcrumTopic; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  const tl = timeLeft(topic.voting_ends_at)
  const deviation = Math.abs(topic.blue_pct - 50)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: rank * 0.04 }}
      className="rounded-2xl border border-surface-200 bg-surface-100 overflow-hidden"
    >
      {/* Top bar with rank + score */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-surface-200">
        <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-gold/10 border border-gold/20">
          <span className="text-xs font-mono font-bold text-gold">#{rank}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {topic.category && (
              <span className={cn(
                'text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border',
                categoryClass(topic.category)
              )}>
                {topic.category}
              </span>
            )}
            <Badge
              variant={topic.status === 'voting' ? 'active' : 'active'}
              className="text-[10px]"
            >
              {topic.status === 'voting' ? 'Voting' : 'Active'}
            </Badge>
            {tl && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-gold">
                <Timer className="h-3 w-3" />
                {tl}
              </span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center gap-1 text-[11px] font-mono text-surface-500">
          <Scale className={cn(
            'h-3.5 w-3.5',
            deviation <= 3 ? 'text-gold' : 'text-surface-500'
          )} />
          <span className="tabular-nums">{topic.balance_score.toFixed(1)}</span>
        </div>
      </div>

      {/* Statement */}
      <div className="px-4 py-3">
        <Link
          href={`/topic/${topic.id}`}
          className="group flex items-start gap-2 hover:no-underline"
        >
          <p className="font-mono font-semibold text-sm text-white leading-relaxed group-hover:text-for-300 transition-colors">
            {topic.statement}
          </p>
          <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-surface-500 group-hover:text-for-400 transition-colors" />
        </Link>
      </div>

      {/* Balance meter */}
      <div className="px-4 pb-3">
        <BalanceMeter bluePct={topic.blue_pct} />
      </div>

      {/* Vote stats row */}
      <div className="px-4 pb-3 flex items-center gap-4 text-[11px] font-mono text-surface-500">
        <div className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          <span>{fmtVotes(topic.total_votes)} votes</span>
        </div>
        <div className="flex items-center gap-1 text-for-400">
          <ThumbsUp className="h-3 w-3" />
          <span>{fmtVotes(topic.blue_votes)}</span>
        </div>
        <div className="flex items-center gap-1 text-against-400">
          <ThumbsDown className="h-3 w-3" />
          <span>{fmtVotes(topic.red_votes)}</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <MessageSquare className="h-3.5 w-3.5" />
          <span className="text-for-400">{topic.blue_args_count}</span>
          <span>/</span>
          <span className="text-against-400">{topic.red_args_count}</span>
          <span>args</span>
        </div>
      </div>

      {/* Decisive arguments toggle */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 border-t border-surface-200 hover:bg-surface-200/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-xs font-mono text-surface-400">
          <Sparkles className="h-3.5 w-3.5 text-gold" />
          <span>Decisive arguments</span>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-surface-500" />
          : <ChevronDown className="h-4 w-4 text-surface-500" />
        }
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ArgCard arg={topic.top_blue_arg} side="blue" topicId={topic.id} />
              <ArgCard arg={topic.top_red_arg} side="red" topicId={topic.id} />
            </div>
            <div className="px-4 pb-4">
              <Link
                href={`/topic/${topic.id}/argue`}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Add your argument
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function FulcrumSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-surface-200 bg-surface-100 overflow-hidden">
          <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-surface-200">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
          </div>
          <div className="px-4 py-3 space-y-2">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-3/4 rounded" />
          </div>
          <div className="px-4 pb-3 space-y-2">
            <Skeleton className="h-2.5 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FulcrumClient() {
  const [data, setData] = useState<FulcrumResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const lastFetchRef = useRef<number>(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/fulcrum', { cache: 'no-store' })
      if (!res.ok) throw new Error(`${res.status}`)
      const json: FulcrumResponse = await res.json()
      setData(json)
      lastFetchRef.current = Date.now()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const timeSince = data
    ? Math.floor((Date.now() - new Date(data.generated_at).getTime()) / 60_000)
    : 0

  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      <TopBar />

      <div className="max-w-2xl mx-auto px-4 pt-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Scale className="h-5 w-5 text-gold" />
                <h1 className="text-xl font-mono font-bold text-white tracking-tight">
                  The Civic Fulcrum
                </h1>
              </div>
              <p className="text-sm font-mono text-surface-500 leading-relaxed">
                Debates balanced on a knife&#8209;edge — near&#8209;perfect 50/50 splits with
                compelling arguments holding each side in place.
              </p>
            </div>
            <button
              onClick={() => setInfoOpen(v => !v)}
              className="flex-shrink-0 p-2 rounded-lg hover:bg-surface-200 text-surface-500 hover:text-white transition-colors"
              aria-label="About the Fulcrum Score"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>

          {/* Info panel */}
          <AnimatePresence>
            {infoOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mt-3"
              >
                <div className="rounded-xl border border-gold/20 bg-gold/5 p-4 space-y-2">
                  <p className="text-xs font-mono font-semibold text-gold">How the Fulcrum Score works</p>
                  <p className="text-xs font-mono text-surface-400 leading-relaxed">
                    <strong className="text-white">Fulcrum Score = proximity-to-50/50 × log₁₀(vote volume)</strong>.
                    Topics are scored by how close they are to a perfect 50/50 vote split,
                    then weighted by total votes so well-debated topics rank higher than fringe debates.
                  </p>
                  <p className="text-xs font-mono text-surface-400 leading-relaxed">
                    The <strong className="text-white">decisive argument</strong> shown for each side
                    is ranked by upvotes (60%) and AI quality score (40%) — the argument most likely
                    to be influencing how people vote.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Stats bar */}
        {data && !loading && (
          <div className="flex items-center gap-3 mb-5 text-[11px] font-mono text-surface-500">
            <div className="flex items-center gap-1">
              <Scale className="h-3.5 w-3.5 text-gold" />
              <span>{data.topics.length} balanced debates</span>
            </div>
            <span className="text-surface-600">·</span>
            <div className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <span>from {data.total_analyzed} analyzed</span>
            </div>
            {timeSince > 0 && (
              <>
                <span className="text-surface-600">·</span>
                <span>{timeSince}m ago</span>
              </>
            )}
            <button
              onClick={load}
              disabled={loading}
              className="ml-auto flex items-center gap-1 text-surface-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <FulcrumSkeleton />
        ) : error ? (
          <div className="rounded-xl border border-against-800/40 bg-against-950/20 p-6 text-center">
            <p className="text-sm font-mono text-against-400">Failed to load: {error}</p>
            <button
              onClick={load}
              className="mt-3 text-xs font-mono text-surface-400 hover:text-white underline"
            >
              Try again
            </button>
          </div>
        ) : !data || data.topics.length === 0 ? (
          <EmptyState
            icon={Scale}
            iconColor="text-gold"
            iconBg="bg-gold/10"
            iconBorder="border-gold/20"
            title="No balanced debates right now"
            description="The Fulcrum requires topics with at least 50 votes and a near-50/50 split. Check back as more debates heat up."
            actions={[
              { label: 'Browse all topics', href: '/topics' },
              { label: 'Vote now', href: '/', variant: 'secondary' },
            ]}
          />
        ) : (
          <div className="space-y-4">
            {data.topics.map((topic, i) => (
              <FulcrumCard key={topic.id} topic={topic} rank={i + 1} />
            ))}

            {/* Footer context */}
            <div className="pt-2 pb-4 text-center space-y-1">
              <p className="text-[11px] font-mono text-surface-600">
                Showing topics with FOR% between 35% and 65% · minimum 50 votes
              </p>
              <div className="flex items-center justify-center gap-4 text-[11px] font-mono text-surface-600">
                <Link href="/tipping-point" className="hover:text-white transition-colors flex items-center gap-1">
                  <Gavel className="h-3 w-3" />
                  Near threshold
                </Link>
                <Link href="/schism" className="hover:text-white transition-colors flex items-center gap-1">
                  <Scale className="h-3 w-3" />
                  Deepest divides
                </Link>
                <Link href="/topics" className="hover:text-white transition-colors flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" />
                  All topics
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
