'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Gavel,
  Loader2,
  RefreshCw,
  Scale,
  Skull,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { VerdictItem, VerdictsResponse } from '@/app/api/topics/verdicts/route'

// ─── Category colours ─────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-purple',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-300',
}

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
  const w = Math.floor(d / 7)
  if (w < 5) return `${w}w ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function durationLabel(createdAt: string, updatedAt: string): string {
  const ms = new Date(updatedAt).getTime() - new Date(createdAt).getTime()
  const d = Math.floor(ms / 86_400_000)
  const h = Math.floor(ms / 3_600_000)
  if (d >= 1) return `${d}d debate`
  if (h >= 1) return `${h}h debate`
  return 'short debate'
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function VerdictSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300/40 bg-surface-100 p-5 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-4 w-24 rounded" />
      </div>
      <Skeleton className="h-5 w-full rounded" />
      <Skeleton className="h-5 w-4/5 rounded" />
      <div className="flex gap-2 mt-2">
        <Skeleton className="h-2 flex-1 rounded-full" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-4 w-20 rounded" />
        <Skeleton className="h-4 w-24 rounded" />
      </div>
    </div>
  )
}

// ─── Single verdict card ──────────────────────────────────────────────────────

function VerdictCard({ verdict }: { verdict: VerdictItem }) {
  const isLaw = verdict.status === 'law'
  const forPct = Math.round(verdict.blue_pct)
  const againstPct = 100 - forPct
  const catColor = verdict.category ? (CATEGORY_COLORS[verdict.category] ?? 'text-surface-500') : 'text-surface-500'

  const topicHref  = `/topic/${verdict.id}`
  const actionHref = isLaw && verdict.law_id ? `/law/${verdict.law_id}` : topicHref

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border bg-surface-100 p-5 transition-colors',
        isLaw
          ? 'border-emerald/30 hover:border-emerald/50'
          : 'border-surface-300/40 hover:border-surface-400/60',
      )}
    >
      {/* ── Header row ────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 mb-3">
        {/* Verdict badge */}
        <div
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-mono font-semibold shrink-0',
            isLaw
              ? 'bg-emerald/10 border-emerald/30 text-emerald'
              : 'bg-surface-200 border-surface-300 text-surface-500',
          )}
        >
          {isLaw ? <Gavel className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {isLaw ? 'BECAME LAW' : 'PROPOSAL FAILED'}
        </div>

        {/* Category */}
        {verdict.category && (
          <span className={cn('text-xs font-mono mt-0.5 truncate', catColor)}>
            {verdict.category}
          </span>
        )}

        {/* Timestamp */}
        <span className="ml-auto text-xs font-mono text-surface-500 shrink-0 mt-0.5">
          {relativeTime(verdict.updated_at)}
        </span>
      </div>

      {/* ── Statement ─────────────────────────────────────────────────────── */}
      <Link
        href={topicHref}
        className="block font-mono text-sm font-medium text-white leading-snug hover:text-for-300 transition-colors mb-3 line-clamp-3"
      >
        {verdict.statement}
      </Link>

      {/* ── Vote split bar ─────────────────────────────────────────────────── */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5 text-[11px] font-mono">
          <span className="text-for-400 font-semibold">{forPct}% FOR</span>
          <span className="text-surface-500">{verdict.total_votes.toLocaleString()} votes</span>
          <span className="text-against-400 font-semibold">AGAINST {againstPct}%</span>
        </div>
        <div className="h-2 w-full rounded-full overflow-hidden bg-surface-300 flex">
          <div className="bg-for-500 h-full transition-all" style={{ width: `${forPct}%` }} />
          <div className="flex-1 bg-against-500 h-full" />
        </div>
      </div>

      {/* ── User outcome strips ────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-3">
        {/* Vote outcome */}
        {verdict.user_vote !== null && (
          <div
            className={cn(
              'flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-mono',
              verdict.user_won === true
                ? 'bg-emerald/10 border-emerald/30 text-emerald'
                : verdict.user_won === false
                ? 'bg-against-500/10 border-against-500/30 text-against-400'
                : 'bg-surface-200 border-surface-300 text-surface-500',
            )}
          >
            {verdict.user_vote === 'blue'
              ? <ThumbsUp className="h-3 w-3" />
              : <ThumbsDown className="h-3 w-3" />}
            You voted {verdict.user_vote === 'blue' ? 'FOR' : 'AGAINST'}
            {verdict.user_won === true && (
              <CheckCircle2 className="h-3 w-3 text-emerald" />
            )}
            {verdict.user_won === false && (
              <XCircle className="h-3 w-3 text-against-400" />
            )}
          </div>
        )}

        {/* Prediction outcome */}
        {verdict.prediction_correct !== null && (
          <div
            className={cn(
              'flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-mono',
              verdict.prediction_correct
                ? 'bg-for-500/10 border-for-500/30 text-for-300'
                : 'bg-against-500/10 border-against-500/30 text-against-400',
            )}
          >
            <Trophy className="h-3 w-3" />
            Prediction {verdict.prediction_correct ? 'correct' : 'wrong'}
          </div>
        )}
      </div>

      {/* ── Footer row ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-surface-600">
          {durationLabel(verdict.created_at, verdict.updated_at)}
        </span>
        <Link
          href={actionHref}
          className={cn(
            'flex items-center gap-1 text-[11px] font-mono transition-colors',
            isLaw ? 'text-emerald hover:text-emerald/80' : 'text-surface-500 hover:text-surface-400',
          )}
        >
          {isLaw ? 'View law' : 'View topic'}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

const FILTERS = [
  { id: 'all',    label: 'All Verdicts', icon: Scale },
  { id: 'law',    label: 'Became Law',   icon: Gavel },
  { id: 'failed', label: 'Failed',       icon: XCircle },
] as const

type FilterId = typeof FILTERS[number]['id']

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VerdictsPage() {
  const [filter, setFilter]         = useState<FilterId>('all')
  const [verdicts, setVerdicts]     = useState<VerdictItem[]>([])
  const [total, setTotal]           = useState(0)
  const [hasMore, setHasMore]       = useState(false)
  const [cursor, setCursor]         = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const fetchVerdicts = useCallback(async (f: FilterId, cur: string | null, append: boolean) => {
    if (append) setLoadingMore(true)
    else { setLoading(true); setError(null) }

    try {
      const params = new URLSearchParams({ filter: f, limit: '20' })
      if (cur) params.set('cursor', cur)
      const res = await fetch(`/api/topics/verdicts?${params}`)
      if (!res.ok) throw new Error('Failed to load')
      const data = (await res.json()) as VerdictsResponse

      setVerdicts((prev) => append ? [...prev, ...data.verdicts] : data.verdicts)
      setTotal(data.total)
      setHasMore(data.has_more)
      setCursor(data.next_cursor)
    } catch {
      setError('Could not load verdicts. Please try again.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  // Initial load + re-fetch on filter change
  useEffect(() => {
    setCursor(null)
    fetchVerdicts(filter, null, false)
  }, [filter, fetchVerdicts])

  const headerLabel = filter === 'law' ? 'Laws' : filter === 'failed' ? 'Failed' : 'Verdicts'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* ── Page header ───────────────────────────────────────────────────── */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/30">
              <Gavel className="h-5 w-5 text-emerald" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                The Verdicts
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {loading ? 'Loading…' : `${total.toLocaleString()} ${headerLabel.toLowerCase()} rendered`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/graveyard"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors text-xs font-mono"
              aria-label="View the Graveyard"
            >
              <Skull className="h-3.5 w-3.5" />
              Graveyard
            </Link>
            <button
              onClick={() => fetchVerdicts(filter, null, false)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors text-xs font-mono disabled:opacity-40"
              aria-label="Refresh verdicts"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Filter tabs ───────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 no-scrollbar">
          {FILTERS.map((f) => {
            const Icon = f.icon
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-mono font-medium whitespace-nowrap transition-colors',
                  filter === f.id
                    ? f.id === 'law'
                      ? 'bg-emerald/10 border-emerald/30 text-emerald'
                      : f.id === 'failed'
                      ? 'bg-against-500/10 border-against-500/30 text-against-400'
                      : 'bg-for-500/10 border-for-500/30 text-for-300'
                    : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {f.label}
              </button>
            )
          })}
        </div>

        {/* ── Legend / context strip ────────────────────────────────────────── */}
        {!loading && verdicts.length > 0 && (
          <div className="flex flex-wrap items-center gap-4 mb-5 px-1 text-[11px] font-mono text-surface-500">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald" />
              Your side won
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5 text-against-400" />
              Your side lost
            </div>
            <div className="flex items-center gap-1.5">
              <Circle className="h-3.5 w-3.5 text-surface-500" />
              You didn&apos;t vote
            </div>
          </div>
        )}

        {/* ── Verdict list ──────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <VerdictSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/5 p-6 text-center">
            <p className="font-mono text-sm text-against-400 mb-3">{error}</p>
            <button
              onClick={() => fetchVerdicts(filter, null, false)}
              className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-colors"
            >
              Try again
            </button>
          </div>
        ) : verdicts.length === 0 ? (
          <EmptyState
            icon={Gavel}
            iconColor="text-emerald"
            iconBg="bg-emerald/10"
            iconBorder="border-emerald/20"
            title="No verdicts yet"
            description={
              filter === 'law'
                ? 'No topics have become law yet. Cast your votes to help build consensus.'
                : filter === 'failed'
                ? 'No proposals have failed yet.'
                : 'Topics that reach consensus or fail their vote appear here.'
            }
            actions={[{ label: 'Browse topics', href: '/' }]}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={filter}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {verdicts.map((v) => (
                <VerdictCard key={v.id} verdict={v} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Load more ─────────────────────────────────────────────────────── */}
        {hasMore && !loading && !error && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => fetchVerdicts(filter, cursor, true)}
              disabled={loadingMore}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl',
                'bg-surface-100 border border-surface-300 text-surface-400',
                'hover:bg-surface-200 hover:text-white hover:border-surface-400',
                'text-sm font-mono transition-colors disabled:opacity-50',
              )}
            >
              {loadingMore ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Load more verdicts
            </button>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
