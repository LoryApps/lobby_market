'use client'

/**
 * /topic/[id]/dissent — The Loyal Opposition
 *
 * Surfaces the minority view in a civic debate:
 *   • Which side is the numerical minority and by how much
 *   • The strongest arguments from that minority, ranked by upvotes
 *   • Who is making those arguments (voice profiles)
 *   • Why the minority view deserves civic respect
 *
 * Distinct from:
 *   /versus       — shows strongest FOR and AGAINST arguments head-to-head
 *   /steelman     — AI generates the best possible case for both sides
 *   /archetypes   — vote breakdown by civic archetype, not minority focus
 *   /arguments    — full argument list, not minority-filtered
 *
 * This page exists because democracy depends on protecting minority views.
 * A landslide can be wrong. History proves it regularly.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Gavel,
  MessageSquare,
  Quote,
  RefreshCw,
  Scale,
  Shield,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { DissentData, DissentArgument } from '@/app/api/topics/[id]/dissent/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function reltime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const ROLE_LABELS: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
  lawmaker: 'Lawmaker',
  senator: 'Senator',
}

const GRADE_STYLE: Record<string, { text: string; bg: string }> = {
  A: { text: 'text-emerald', bg: 'bg-emerald/10' },
  B: { text: 'text-for-400', bg: 'bg-for-500/10' },
  C: { text: 'text-gold', bg: 'bg-gold/10' },
  D: { text: 'text-against-400', bg: 'bg-against-500/10' },
  F: { text: 'text-surface-500', bg: 'bg-surface-300/50' },
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
        <Skeleton className="h-4 w-28 mb-4" />
        <Skeleton className="h-8 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
        <Skeleton className="h-5 w-32 mb-4" />
        <div className="flex gap-2 mb-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
        </div>
        <Skeleton className="h-3 w-full mb-2" />
        <Skeleton className="h-3 w-5/6" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
          <div className="flex gap-3 mb-3">
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-3 w-24 mb-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-4 w-full mb-1" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ))}
    </div>
  )
}

// ─── Vote bar ─────────────────────────────────────────────────────────────────

function VoteSplitBar({
  bluePct,
  minoritySide,
  isDeadlock,
}: {
  bluePct: number
  minoritySide: 'for' | 'against'
  isDeadlock: boolean
}) {
  const redPct = 100 - bluePct

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[11px] font-mono font-semibold">
        <span className={cn('text-for-400', minoritySide === 'for' && 'opacity-70')}>
          {bluePct}% FOR
          {minoritySide === 'for' && (
            <span className="ml-1.5 text-[10px] text-surface-500 font-normal">(minority)</span>
          )}
        </span>
        <span className={cn('text-against-400', minoritySide === 'against' && 'opacity-70')}>
          {redPct}% AGAINST
          {minoritySide === 'against' && (
            <span className="mr-1.5 text-[10px] text-surface-500 font-normal">(minority)</span>
          )}
        </span>
      </div>
      <div className="h-3 w-full rounded-full overflow-hidden bg-surface-300 flex">
        <motion.div
          className={cn(
            'h-full rounded-l-full transition-all',
            isDeadlock
              ? 'bg-gradient-to-r from-for-600 to-for-400'
              : minoritySide === 'for'
              ? 'bg-for-700/60'
              : 'bg-for-500'
          )}
          style={{ width: `${bluePct}%` }}
          initial={{ width: 0 }}
          animate={{ width: `${bluePct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        <motion.div
          className={cn(
            'h-full rounded-r-full transition-all',
            isDeadlock
              ? 'bg-gradient-to-l from-against-600 to-against-400'
              : minoritySide === 'against'
              ? 'bg-against-700/60'
              : 'bg-against-500'
          )}
          style={{ width: `${redPct}%` }}
          initial={{ width: 0 }}
          animate={{ width: `${redPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
        />
      </div>
    </div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  topicId,
  rank,
  minoritySide,
}: {
  arg: DissentArgument
  topicId: string
  rank: number
  minoritySide: 'for' | 'against'
}) {
  const sideColor = minoritySide === 'for' ? 'text-for-400' : 'text-against-400'
  const sideBg = minoritySide === 'for' ? 'bg-for-500/8 border-for-500/20' : 'bg-against-500/8 border-against-500/20'
  const gradeStyle = arg.ai_grade ? GRADE_STYLE[arg.ai_grade] ?? GRADE_STYLE.C : null

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
      className={cn(
        'rounded-2xl border p-4 transition-colors',
        sideBg,
        'hover:border-surface-400/40'
      )}
    >
      {/* Rank + author row */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-surface-300/60 text-[11px] font-mono font-bold text-surface-500 mt-0.5">
          {rank}
        </div>
        {arg.author ? (
          <Link
            href={`/profile/${arg.author.username}`}
            className="flex items-center gap-2 min-w-0 group"
          >
            <Avatar
              src={arg.author.avatar_url}
              fallback={arg.author.display_name || arg.author.username}
              size="xs"
              className="flex-shrink-0"
            />
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-white group-hover:text-for-300 transition-colors truncate">
                {arg.author.display_name || arg.author.username}
              </p>
              <p className="text-[10px] font-mono text-surface-500">
                {ROLE_LABELS[arg.author.role] ?? 'Citizen'} · {arg.author.clout.toLocaleString()} clout
              </p>
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-surface-300/50 flex-shrink-0" />
            <span className="text-[12px] text-surface-500">Anonymous</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {gradeStyle && arg.ai_grade && (
            <span
              className={cn(
                'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border',
                gradeStyle.text,
                gradeStyle.bg,
                'border-current/30'
              )}
            >
              {arg.ai_grade}
            </span>
          )}
          <span className="text-[10px] font-mono text-surface-600">{reltime(arg.created_at)}</span>
        </div>
      </div>

      {/* Argument content */}
      <p className="text-[13px] text-surface-700 leading-relaxed mb-3 ml-9">
        {arg.content}
      </p>

      {/* Footer stats */}
      <div className="flex items-center gap-4 ml-9">
        <div className={cn('flex items-center gap-1 text-[11px] font-mono', sideColor)}>
          <ThumbsUp className="h-3 w-3" aria-hidden />
          <span>{arg.upvote_count.toLocaleString()}</span>
        </div>
        {arg.reply_count > 0 && (
          <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <MessageSquare className="h-3 w-3" aria-hidden />
            <span>{arg.reply_count}</span>
          </div>
        )}
        <Link
          href={`/topic/${topicId}/arguments`}
          className="ml-auto text-[10px] font-mono text-surface-600 hover:text-for-400 transition-colors"
        >
          View thread →
        </Link>
      </div>
    </motion.article>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DissentClient({ topicId }: { topicId: string }) {
  const router = useRouter()
  const [data, setData] = useState<DissentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/dissent`, { signal: ctrl.signal })
      if (!res.ok) {
        if (res.status === 404) { router.replace(`/topic/${topicId}`); return }
        throw new Error(`HTTP ${res.status}`)
      }
      setData(await res.json() as DissentData)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError('Failed to load dissent data')
    } finally {
      if (!ctrl.signal.aborted) setLoading(false)
    }
  }, [topicId, router])

  useEffect(() => { load() }, [load])

  const d = data
  const minorityLabel = d ? (d.minority_side === 'for' ? 'FOR' : 'AGAINST') : ''
  const majorityLabel = d ? (d.majority_side === 'for' ? 'FOR' : 'AGAINST') : ''
  const minorityColor = d
    ? d.minority_side === 'for'
      ? 'text-for-400'
      : 'text-against-400'
    : 'text-surface-500'
  const majorityColor = d
    ? d.majority_side === 'for'
      ? 'text-for-400'
      : 'text-against-400'
    : 'text-surface-500'
  const minorityBorder = d
    ? d.minority_side === 'for'
      ? 'border-for-500/30'
      : 'border-against-500/30'
    : 'border-surface-400/30'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back nav */}
        {d && (
          <Link
            href={`/topic/${topicId}`}
            className="inline-flex items-center gap-1.5 text-[12px] font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to debate
          </Link>
        )}

        {loading && <PageSkeleton />}

        {error && (
          <EmptyState
            icon={AlertCircle}
            title="Couldn't load dissent data"
            description={error}
            action={
              <button
                onClick={load}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            }
          />
        )}

        {d && !loading && (
          <AnimatePresence>
            <div className="space-y-4">

              {/* ── Header card ── */}
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <div className="flex items-center gap-2 text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-3">
                  <Scale className="h-3.5 w-3.5" />
                  Minority Report
                  {d.topic.category && (
                    <>
                      <span className="text-surface-600">·</span>
                      <span>{d.topic.category}</span>
                    </>
                  )}
                </div>

                <h1 className="text-base font-semibold text-white leading-snug mb-4">
                  {d.topic.statement}
                </h1>

                {/* Vote split */}
                <VoteSplitBar
                  bluePct={Math.round(d.topic.blue_pct)}
                  minoritySide={d.minority_side}
                  isDeadlock={d.is_deadlock}
                />

                {/* Quick stats */}
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className={cn('text-xl font-mono font-bold', minorityColor)}>
                      {d.minority_pct}%
                    </p>
                    <p className="text-[10px] font-mono text-surface-500 mt-0.5">
                      minority
                    </p>
                  </div>
                  <div className="text-center border-x border-surface-300">
                    <p className="text-xl font-mono font-bold text-white">
                      {d.minority_count.toLocaleString()}
                    </p>
                    <p className="text-[10px] font-mono text-surface-500 mt-0.5">
                      dissenting votes
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-mono font-bold text-purple">
                      {d.total_dissent_arguments}
                    </p>
                    <p className="text-[10px] font-mono text-surface-500 mt-0.5">
                      {d.minority_side === 'for' ? 'FOR' : 'AGAINST'} arguments
                    </p>
                  </div>
                </div>

                {/* Status badge */}
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  {d.is_deadlock && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-against-500/10 border border-against-500/30 text-[10px] font-mono text-against-400">
                      <AlertCircle className="h-3 w-3" />
                      Deadlock Territory
                    </span>
                  )}
                  {d.topic.status === 'law' && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gold/10 border border-gold/30 text-[10px] font-mono text-gold">
                      <Gavel className="h-3 w-3" />
                      Established Law — minority view archived
                    </span>
                  )}
                  {d.topic.status === 'voting' && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple/10 border border-purple/30 text-[10px] font-mono text-purple">
                      <Zap className="h-3 w-3" />
                      Active vote — minority can still win
                    </span>
                  )}
                </div>
              </motion.div>

              {/* ── Insight panel ── */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className={cn(
                  'rounded-2xl border p-4',
                  'bg-surface-100',
                  minorityBorder
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('flex-shrink-0 mt-0.5', minorityColor)}>
                    <Quote className="h-4 w-4" />
                  </div>
                  <p className="text-[13px] text-surface-700 leading-relaxed italic">
                    {d.insight}
                  </p>
                </div>
              </motion.div>

              {/* ── Why minority view matters ── */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <div className="flex items-center gap-2 text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-3">
                  <Shield className="h-3.5 w-3.5 text-for-400" />
                  Why Dissent Matters
                </div>
                <div className="space-y-2.5 text-[12px] text-surface-600 leading-relaxed">
                  <p>
                    The <span className={cn('font-semibold', majorityColor)}>{d.majority_pct}% {majorityLabel}</span> camp
                    holds the majority — but{' '}
                    <span className={cn('font-semibold', minorityColor)}>
                      {d.minority_count.toLocaleString()} voices ({d.minority_pct}%)
                    </span>{' '}
                    disagree.
                  </p>
                  <p>
                    History is full of moments when the minority was right. These are the arguments
                    they made — the case that didn&apos;t win the vote but may deserve more attention
                    than the numbers suggest.
                  </p>
                  {d.total_dissent_arguments > 0 && (
                    <p>
                      <span className="font-semibold text-surface-500">{d.total_dissent_arguments} {minorityLabel} arguments</span>{' '}
                      have been posted to this debate. Below are the strongest by community upvotes.
                    </p>
                  )}
                </div>
              </motion.div>

              {/* ── Top dissenting arguments ── */}
              {d.top_arguments.length > 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <div className="flex items-center gap-2 text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-3 px-1">
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>Top Dissenting Arguments</span>
                    <span className="ml-auto text-[10px]">{d.minority_pct}% {minorityLabel}</span>
                  </div>
                  <div className="space-y-3">
                    {d.top_arguments.map((arg, i) => (
                      <ArgumentCard
                        key={arg.id}
                        arg={arg}
                        topicId={topicId}
                        rank={i + 1}
                        minoritySide={d.minority_side}
                      />
                    ))}
                  </div>
                </motion.div>
              ) : (
                <EmptyState
                  icon={MessageSquare}
                  title="No dissenting arguments yet"
                  description={`The ${minorityLabel} side has votes but no arguments posted. Be the first to make the case.`}
                  action={
                    <Link
                      href={`/topic/${topicId}`}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
                    >
                      Post an argument
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  }
                />
              )}

              {/* ── Explore more ── */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-3">
                  Explore This Debate
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { href: `/topic/${topicId}/versus`, label: 'FOR vs AGAINST', icon: Scale },
                    { href: `/topic/${topicId}/steelman`, label: 'Steelman Arguments', icon: Shield },
                    { href: `/topic/${topicId}/arguments`, label: 'All Arguments', icon: MessageSquare },
                    { href: `/topic/${topicId}/archetypes`, label: 'Archetype Votes', icon: Users },
                  ].map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 hover:bg-surface-200 transition-all group"
                    >
                      <Icon className="h-3.5 w-3.5 text-surface-500 group-hover:text-for-400 transition-colors flex-shrink-0" />
                      <span className="text-[11px] font-mono text-surface-600 group-hover:text-white transition-colors">
                        {label}
                      </span>
                      <ChevronRight className="h-3 w-3 text-surface-600 ml-auto group-hover:text-white transition-colors" />
                    </Link>
                  ))}
                </div>
              </motion.div>

            </div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
