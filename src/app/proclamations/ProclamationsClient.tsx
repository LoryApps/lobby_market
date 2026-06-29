'use client'

/**
 * /proclamations — The Civic Proclamations Board
 *
 * The permanent public record of all Grand Council motions — official decrees,
 * elevated topics, and assembly calls from the platform's top 20 citizens.
 *
 * Distinct from:
 *   /grand-council   — live governance chamber with voting UI
 *   /council         — council member roster and active motions
 *   /assembly        — Citizens' Assembly deliberations
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Crown,
  FileText,
  Gavel,
  RefreshCw,
  Scroll,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { Proclamation, ProclamationsResponse } from '@/app/api/proclamations/route'

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'all' | 'passed' | 'active' | 'rejected'

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'passed', label: 'Passed' },
  { id: 'active', label: 'Active' },
  { id: 'rejected', label: 'Rejected' },
]

// ─── Effect config ────────────────────────────────────────────────────────────

const EFFECT_CONFIG = {
  issue_statement: {
    label: 'Statement',
    icon: FileText,
    color: 'text-for-400',
    bg: 'bg-for-600/10',
    border: 'border-for-500/30',
  },
  elevate_topic: {
    label: 'Topic Elevated',
    icon: TrendingUp,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
  },
  call_assembly: {
    label: 'Assembly Called',
    icon: Users,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
  },
} as const

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  passed: {
    label: 'PASSED',
    icon: CheckCircle2,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
  },
  active: {
    label: 'IN VOTE',
    icon: Clock,
    color: 'text-for-400',
    bg: 'bg-for-600/10',
    border: 'border-for-500/30',
  },
  rejected: {
    label: 'REJECTED',
    icon: XCircle,
    color: 'text-against-400',
    bg: 'bg-against-600/10',
    border: 'border-against-500/30',
  },
  withdrawn: {
    label: 'WITHDRAWN',
    icon: X,
    color: 'text-surface-500',
    bg: 'bg-surface-300/10',
    border: 'border-surface-400/30',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d} days ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo} month${mo > 1 ? 's' : ''} ago`
  const yr = Math.floor(mo / 12)
  return `${yr} year${yr > 1 ? 's' : ''} ago`
}

function votePassPercent(p: Proclamation): number {
  const total = p.votes_for + p.votes_against
  if (total === 0) return 0
  return Math.round((p.votes_for / total) * 100)
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ProclamationSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300/50 bg-surface-100 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3.5 w-1/4" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-2/3" />
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-3.5 w-24" />
        </div>
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  )
}

// ─── Vote bar ─────────────────────────────────────────────────────────────────

function VoteBar({ proclamation }: { proclamation: Proclamation }) {
  const total = proclamation.votes_for + proclamation.votes_against
  if (total === 0) {
    return (
      <p className="text-xs text-surface-500 font-mono">No votes cast yet</p>
    )
  }
  const forPct = votePassPercent(proclamation)
  const againstPct = 100 - forPct

  return (
    <div className="space-y-1.5">
      <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full bg-for-500 rounded-full"
        />
      </div>
      <div className="flex justify-between text-[11px] font-mono text-surface-500">
        <span className="flex items-center gap-1">
          <ThumbsUp className="h-3 w-3 text-for-500" />
          {proclamation.votes_for} FOR ({forPct}%)
        </span>
        <span className="flex items-center gap-1">
          {proclamation.votes_against} AGAINST ({againstPct}%)
          <ThumbsDown className="h-3 w-3 text-against-500" />
        </span>
      </div>
    </div>
  )
}

// ─── Proclamation card ────────────────────────────────────────────────────────

function ProclamationCard({ proclamation }: { proclamation: Proclamation }) {
  const effect = EFFECT_CONFIG[proclamation.effect]
  const EffectIcon = effect.icon
  const status = STATUS_CONFIG[proclamation.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.withdrawn
  const StatusIcon = status.icon
  const isPassed = proclamation.status === 'passed'
  const isActive = proclamation.status === 'active'

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'rounded-2xl border bg-surface-100 p-5 space-y-4 relative overflow-hidden',
        isPassed
          ? 'border-gold/30 hover:border-gold/50'
          : isActive
            ? 'border-for-800/60 hover:border-for-700/60'
            : 'border-surface-300/50 hover:border-surface-400/50',
        'transition-colors'
      )}
    >
      {/* Subtle gold glow for passed proclamations */}
      {isPassed && (
        <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-transparent pointer-events-none" />
      )}

      {/* Header: decree number + effect type + status */}
      <div className="flex items-start gap-3">
        {/* Decree number + effect icon */}
        <div
          className={cn(
            'flex-shrink-0 h-9 w-9 rounded-xl border flex items-center justify-center',
            effect.bg,
            effect.border
          )}
        >
          <EffectIcon className={cn('h-4 w-4', effect.color)} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Decree number */}
          <p className={cn('text-[10px] font-mono font-bold uppercase tracking-widest mb-0.5', effect.color)}>
            {effect.label} · #{String(proclamation.decree_number).padStart(3, '0')}
          </p>

          {/* Title */}
          <h3 className="text-sm font-bold text-white leading-snug">
            {proclamation.title}
          </h3>
        </div>

        {/* Status badge */}
        <div
          className={cn(
            'flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-mono font-bold',
            status.bg,
            status.border,
            status.color
          )}
        >
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-surface-400 leading-relaxed">
        {proclamation.description}
      </p>

      {/* Referenced topic if any */}
      {proclamation.topic_statement && (
        <Link
          href={`/topic/${proclamation.topic_id}`}
          className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors group"
        >
          <Gavel className="h-3.5 w-3.5 text-gold flex-shrink-0" />
          <span className="text-xs text-surface-400 group-hover:text-surface-300 transition-colors truncate leading-snug">
            {proclamation.topic_statement}
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 flex-shrink-0 ml-auto transition-colors" />
        </Link>
      )}

      {/* Vote tally */}
      <VoteBar proclamation={proclamation} />

      {/* Footer: proposer + date */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-surface-300/40">
        {/* Proposer */}
        {proclamation.proposer ? (
          <Link
            href={`/profile/${proclamation.proposer.username}`}
            className="flex items-center gap-2 group min-w-0"
          >
            <div className="relative flex-shrink-0">
              <Avatar
                src={proclamation.proposer.avatar_url}
                fallback={proclamation.proposer.display_name ?? proclamation.proposer.username}
                size="xs"
              />
              {proclamation.proposer.council_rank > 0 && proclamation.proposer.council_rank <= 3 && (
                <span className="absolute -top-1 -right-1 text-[8px]">
                  {proclamation.proposer.council_rank === 1 ? '👑' : '⭐'}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-surface-300 group-hover:text-white transition-colors truncate leading-tight">
                {proclamation.proposer.display_name ?? proclamation.proposer.username}
              </p>
              {proclamation.proposer.council_rank > 0 && (
                <p className="text-[10px] text-surface-600 leading-tight">
                  Council #{proclamation.proposer.council_rank}
                </p>
              )}
            </div>
          </Link>
        ) : (
          <span className="text-xs text-surface-600 italic">Unknown proposer</span>
        )}

        {/* Date */}
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] font-mono text-surface-500">
            {isPassed && proclamation.resolved_at
              ? `Passed ${formatDateShort(proclamation.resolved_at)}`
              : isActive
                ? `Closes ${formatDateShort(proclamation.closes_at)}`
                : `Proposed ${formatDateShort(proclamation.created_at)}`}
          </p>
          {isPassed && (
            <p className="text-[10px] font-mono text-surface-600">
              {proclamation.resolved_at ? timeAgo(proclamation.resolved_at) : ''}
            </p>
          )}
        </div>
      </div>
    </motion.article>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProclamationsClient() {
  const [data, setData] = useState<ProclamationsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/proclamations')
      if (!res.ok) throw new Error('Failed to load')
      const json: ProclamationsResponse = await res.json()
      setData(json)
    } catch {
      setError('Could not load proclamations. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = data?.proclamations.filter((p) => {
    if (tab === 'passed') return p.status === 'passed'
    if (tab === 'active') return p.status === 'active'
    if (tab === 'rejected') return p.status === 'rejected' || p.status === 'withdrawn'
    return true
  }) ?? []

  return (
    <>
      <TopBar />

      <main className="min-h-screen bg-surface-50 pb-24 pt-14">
        {/* ── Page header ── */}
        <div className="border-b border-surface-300/40 bg-surface-50">
          <div className="mx-auto max-w-2xl px-4 py-8">
            {/* Back link */}
            <Link
              href="/grand-council"
              className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-400 transition-colors font-mono mb-6"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Grand Council
            </Link>

            {/* Title block */}
            <div className="flex items-start gap-4">
              {/* Seal */}
              <div className="flex-shrink-0 h-14 w-14 rounded-2xl bg-gold/10 border border-gold/30 flex items-center justify-center">
                <Scroll className="h-7 w-7 text-gold" />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Civic Proclamations
                </h1>
                <p className="mt-1 text-sm text-surface-500 leading-relaxed max-w-sm">
                  Official decrees, resolutions, and elevated motions from the Grand Council —
                  the top 20 citizens governing the Lobby.
                </p>
              </div>
            </div>

            {/* Stats */}
            {data && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 flex items-center gap-6"
              >
                <div className="text-center">
                  <p className="text-2xl font-mono font-bold text-emerald">
                    {data.total_passed}
                  </p>
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">
                    Passed
                  </p>
                </div>
                <div className="h-8 w-px bg-surface-300/50" />
                <div className="text-center">
                  <p className="text-2xl font-mono font-bold text-for-400">
                    {data.total_active}
                  </p>
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">
                    In Vote
                  </p>
                </div>
                <div className="h-8 w-px bg-surface-300/50" />
                <div className="text-center">
                  <p className="text-2xl font-mono font-bold text-white">
                    {data.proclamations.length}
                  </p>
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">
                    Total
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* ── Tabs + content ── */}
        <div className="mx-auto max-w-2xl px-4 pt-4">
          {/* Tab bar */}
          <div className="flex items-center gap-1 mb-5 overflow-x-auto scrollbar-none">
            {TABS.map((t) => {
              const count = data?.proclamations.filter((p) => {
                if (t.id === 'passed') return p.status === 'passed'
                if (t.id === 'active') return p.status === 'active'
                if (t.id === 'rejected') return p.status === 'rejected' || p.status === 'withdrawn'
                return true
              }).length ?? 0

              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-mono font-medium border transition-colors whitespace-nowrap',
                    tab === t.id
                      ? 'bg-surface-300 border-surface-400 text-white'
                      : 'bg-surface-200/50 border-surface-400/30 text-surface-500 hover:text-white hover:border-surface-400'
                  )}
                >
                  {t.label}
                  {!loading && (
                    <span
                      className={cn(
                        'text-[10px]',
                        tab === t.id ? 'text-surface-400' : 'text-surface-600'
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}

            <button
              onClick={load}
              className="ml-auto p-1.5 rounded-full text-surface-500 hover:text-white hover:bg-surface-300 transition-colors flex-shrink-0"
              title="Refresh"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-against-800/50 bg-against-900/20 p-4 text-sm text-against-400 font-mono mb-4">
              {error}
            </div>
          )}

          {/* Loading skeletons */}
          {loading && (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <ProclamationSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Proclamation list */}
          {!loading && !error && (
            <AnimatePresence mode="wait">
              {filtered.length === 0 ? (
                <EmptyState
                  key="empty"
                  icon={Scroll}
                  iconColor="text-gold"
                  iconBg="bg-gold/10"
                  iconBorder="border-gold/30"
                  title={
                    tab === 'passed'
                      ? 'No proclamations yet'
                      : tab === 'active'
                        ? 'No motions in vote'
                        : tab === 'rejected'
                          ? 'No rejected motions'
                          : 'No proclamations yet'
                  }
                  description={
                    tab === 'active'
                      ? 'Grand Council members can propose motions at any time.'
                      : 'When the Grand Council passes motions, they appear here as official proclamations.'
                  }
                  actions={[
                    {
                      label: 'Go to Grand Council',
                      href: '/grand-council',
                      variant: 'primary',
                      icon: Crown,
                    },
                  ]}
                />
              ) : (
                <motion.div
                  key="list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  {filtered.map((proclamation) => (
                    <ProclamationCard
                      key={proclamation.id}
                      proclamation={proclamation}
                    />
                  ))}

                  {/* Grand council CTA */}
                  <div className="pt-4 pb-6 flex flex-col items-center gap-3 text-center">
                    <div className="h-px w-full bg-surface-300/40" />
                    <div className="flex items-center gap-2 text-xs text-surface-600 font-mono mt-2">
                      <Crown className="h-3.5 w-3.5 text-gold" />
                      <span>Motions proposed by the top 20 citizens by clout</span>
                    </div>
                    <Link
                      href="/grand-council"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono font-medium text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
                    >
                      Visit Grand Council
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </main>

      <BottomNav />
    </>
  )
}
