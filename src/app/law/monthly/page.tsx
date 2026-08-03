'use client'

/**
 * /law/monthly — Monthly Law Digest
 *
 * A curated retrospective of laws established in the past 30 days (or custom
 * window via ?days=N). Each law card shows community scrutiny at a glance:
 *   - Community verdict score (did this law achieve its goals?)
 *   - Open challenges (constitutional, procedural, factual, ethical, practical)
 *   - Wiki engagement (collaborative knowledge-building)
 *   - Live discussion activity
 *
 * Sort modes:
 *   Recent     — newest established laws first (default)
 *   Engaged    — most community activity (verdicts + challenges + wiki + chat)
 *   Contested  — highest challenge count
 *   Verdict    — sorted by community verdict score
 *
 * Distinct from:
 *   /law/health   — all-time platform health metrics
 *   /law/verdicts — full verdict voting interface
 *   /law          — codex browse (no monthly filter or scrutiny metrics)
 *   /annual       — all-time platform stats (not law-specific)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  Shield,
  SlidersHorizontal,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { MonthlyLaw, MonthlyStats, MonthlyLawResponse } from '@/app/api/laws/monthly/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function verdictColor(pct: number | null): string {
  if (pct === null) return 'text-surface-500'
  if (pct >= 70) return 'text-emerald'
  if (pct >= 45) return 'text-gold'
  return 'text-against-400'
}

function verdictLabel(pct: number | null): string {
  if (pct === null) return 'No verdicts yet'
  if (pct >= 80) return 'Succeeded'
  if (pct >= 60) return 'Mostly succeeded'
  if (pct >= 40) return 'Mixed results'
  if (pct >= 20) return 'Mostly failed'
  return 'Failed'
}

// ─── Sort types ───────────────────────────────────────────────────────────────

type SortKey = 'recent' | 'engaged' | 'contested' | 'verdict'

const SORT_OPTIONS: { id: SortKey; label: string; icon: typeof Clock }[] = [
  { id: 'recent', label: 'Most Recent', icon: Clock },
  { id: 'engaged', label: 'Most Engaged', icon: Flame },
  { id: 'contested', label: 'Most Challenged', icon: Shield },
  { id: 'verdict', label: 'By Verdict', icon: Trophy },
]

const WINDOW_OPTIONS = [
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
  { days: 60, label: '60 days' },
  { days: 90, label: '90 days' },
]

// ─── Stat Tile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: typeof Gavel
  color: string
}) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex items-center gap-3">
      <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl flex-shrink-0', color)}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-surface-500 leading-none mb-1">{label}</p>
        <p className="text-xl font-bold text-white leading-none">
          <AnimatedNumber value={value} />
        </p>
      </div>
    </div>
  )
}

// ─── Law Card ─────────────────────────────────────────────────────────────────

function LawCard({ law }: { law: MonthlyLaw }) {
  const forPct = Math.round(law.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Badge className="bg-gold/15 text-gold border-gold/30 text-[11px] font-bold flex-shrink-0">
            <Gavel className="h-3 w-3 mr-1" aria-hidden="true" />
            LAW
          </Badge>
          {law.category && (
            <Badge className="bg-surface-300/60 text-surface-600 border-surface-400/50 text-[11px]">
              {law.category}
            </Badge>
          )}
        </div>
        <time
          dateTime={law.established_at}
          className="text-xs text-surface-500 flex-shrink-0"
          title={new Date(law.established_at).toLocaleDateString()}
        >
          {relativeTime(law.established_at)}
        </time>
      </div>

      {/* Statement */}
      <Link
        href={`/law/${law.id}`}
        className="block group"
        aria-label={`View law: ${law.statement}`}
      >
        <h3 className="text-sm font-semibold text-white leading-snug group-hover:text-for-300 transition-colors line-clamp-3">
          {law.statement}
        </h3>
      </Link>

      {/* Vote bar */}
      {law.total_votes !== null && law.total_votes > 0 && (
        <div className="space-y-1">
          <div className="flex overflow-hidden rounded-full h-1.5">
            <div
              className="bg-for-500 transition-all"
              style={{ width: `${forPct}%` }}
              aria-label={`${forPct}% for`}
            />
            <div
              className="bg-against-500 flex-1"
              aria-label={`${againstPct}% against`}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-surface-500">
            <span className="text-for-400">{forPct}% FOR</span>
            <span>{law.total_votes.toLocaleString()} votes</span>
            <span className="text-against-400">{againstPct}% AGAINST</span>
          </div>
        </div>
      )}

      {/* Scrutiny metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Verdict */}
        <div className="rounded-xl bg-surface-200/60 border border-surface-300/50 p-2.5 text-center">
          <div className={cn('text-base font-bold leading-none mb-0.5', verdictColor(law.success_pct))}>
            {law.success_pct !== null ? `${law.success_pct}%` : '—'}
          </div>
          <div className="text-[10px] text-surface-500 leading-tight">
            {law.verdict_count > 0 ? verdictLabel(law.success_pct) : 'No verdicts'}
          </div>
          {law.verdict_count > 0 && (
            <div className="text-[10px] text-surface-600 mt-0.5">{law.verdict_count} votes</div>
          )}
        </div>

        {/* Challenges */}
        <Link
          href={`/law/${law.id}/challenge`}
          className="rounded-xl bg-surface-200/60 border border-surface-300/50 p-2.5 text-center hover:border-against-500/40 transition-colors group"
          aria-label={`${law.total_challenges} challenges`}
        >
          <div className={cn(
            'text-base font-bold leading-none mb-0.5',
            law.open_challenges > 0 ? 'text-against-400' : 'text-surface-600'
          )}>
            {law.total_challenges}
          </div>
          <div className="text-[10px] text-surface-500 leading-tight">
            {law.open_challenges > 0 ? `${law.open_challenges} open` : 'Challenges'}
          </div>
          <Shield className="h-3 w-3 mx-auto mt-0.5 text-surface-500 group-hover:text-against-400 transition-colors" aria-hidden="true" />
        </Link>

        {/* Wiki */}
        <Link
          href={`/law/${law.id}/wiki`}
          className="rounded-xl bg-surface-200/60 border border-surface-300/50 p-2.5 text-center hover:border-for-500/40 transition-colors group"
          aria-label={`${law.wiki_edits} wiki edits`}
        >
          <div className={cn(
            'text-base font-bold leading-none mb-0.5',
            law.wiki_edits > 0 ? 'text-for-400' : 'text-surface-600'
          )}>
            {law.wiki_edits}
          </div>
          <div className="text-[10px] text-surface-500 leading-tight">
            {law.has_wiki ? 'Wiki edits' : 'No wiki'}
          </div>
          <BookOpen className="h-3 w-3 mx-auto mt-0.5 text-surface-500 group-hover:text-for-400 transition-colors" aria-hidden="true" />
        </Link>

        {/* Discussion */}
        <Link
          href={`/law/${law.id}/discuss`}
          className="rounded-xl bg-surface-200/60 border border-surface-300/50 p-2.5 text-center hover:border-purple/40 transition-colors group"
          aria-label={`${law.chat_count} discussion messages`}
        >
          <div className={cn(
            'text-base font-bold leading-none mb-0.5',
            law.chat_count > 0 ? 'text-purple' : 'text-surface-600'
          )}>
            {law.chat_count}
          </div>
          <div className="text-[10px] text-surface-500 leading-tight">
            {law.chat_count > 0 ? 'Messages' : 'No chat'}
          </div>
          <MessageSquare className="h-3 w-3 mx-auto mt-0.5 text-surface-500 group-hover:text-purple transition-colors" aria-hidden="true" />
        </Link>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex gap-2">
          <Link
            href={`/law/${law.id}/verdict`}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              'bg-surface-300/60 text-surface-600 hover:bg-surface-300 hover:text-white'
            )}
          >
            {law.success_pct !== null ? (
              law.success_pct >= 50
                ? <ThumbsUp className="h-3 w-3 text-emerald" aria-hidden="true" />
                : <ThumbsDown className="h-3 w-3 text-against-400" aria-hidden="true" />
            ) : (
              <Scale className="h-3 w-3" aria-hidden="true" />
            )}
            Cast Verdict
          </Link>
          <Link
            href={`/law/${law.id}/challenge`}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              'bg-surface-300/60 text-surface-600 hover:bg-surface-300 hover:text-white'
            )}
          >
            <Shield className="h-3 w-3" aria-hidden="true" />
            Challenge
          </Link>
        </div>
        <Link
          href={`/law/${law.id}`}
          className="flex items-center gap-1 text-xs text-surface-500 hover:text-white transition-colors"
          aria-label="View full law"
        >
          View law
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LawCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-12 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-3 w-full rounded-full" />
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MonthlyLawDigestPage() {
  const [data, setData] = useState<MonthlyLawResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('recent')
  const [windowDays, setWindowDays] = useState(30)
  const [showWindowPicker, setShowWindowPicker] = useState(false)

  const fetchData = useCallback(async (days: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/laws/monthly?days=${days}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json() as MonthlyLawResponse
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(windowDays)
  }, [fetchData, windowDays])

  // Sort
  const sorted = data?.laws ? [...data.laws].sort((a, b) => {
    if (sortKey === 'recent')
      return new Date(b.established_at).getTime() - new Date(a.established_at).getTime()
    if (sortKey === 'engaged')
      return b.engagement_score - a.engagement_score
    if (sortKey === 'contested')
      return b.total_challenges - a.total_challenges || b.open_challenges - a.open_challenges
    // verdict: highest success_pct first, nulls last
    if (sortKey === 'verdict') {
      const pa = a.success_pct ?? -1
      const pb = b.success_pct ?? -1
      return pb - pa
    }
    return 0
  }) : []

  const stats: MonthlyStats | null = data?.stats ?? null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back + title */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/law"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200/60 hover:bg-surface-300 transition-colors flex-shrink-0"
            aria-label="Back to Law Codex"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gold flex-shrink-0" aria-hidden="true" />
              Monthly Law Digest
            </h1>
            <p className="text-xs text-surface-500 mt-0.5">
              New laws · community scrutiny · civic engagement
            </p>
          </div>
          <button
            onClick={() => fetchData(windowDays)}
            className="ml-auto flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200/60 hover:bg-surface-300 transition-colors flex-shrink-0"
            aria-label="Refresh"
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
          </button>
        </div>

        {/* Window picker */}
        <div className="relative mb-4">
          <button
            onClick={() => setShowWindowPicker((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-200/60 border border-surface-300/60 text-sm text-surface-600 hover:text-white hover:border-surface-400 transition-colors"
            aria-expanded={showWindowPicker}
            aria-haspopup="listbox"
          >
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            Past {windowDays} days
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showWindowPicker && 'rotate-180')} aria-hidden="true" />
          </button>
          <AnimatePresence>
            {showWindowPicker && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute top-full left-0 mt-1 z-20 rounded-xl bg-surface-200 border border-surface-300 shadow-xl overflow-hidden"
                role="listbox"
                aria-label="Select time window"
              >
                {WINDOW_OPTIONS.map((opt) => (
                  <button
                    key={opt.days}
                    role="option"
                    aria-selected={windowDays === opt.days}
                    onClick={() => { setWindowDays(opt.days); setShowWindowPicker(false) }}
                    className={cn(
                      'w-full text-left px-4 py-2 text-sm transition-colors',
                      windowDays === opt.days
                        ? 'bg-for-600/20 text-for-300 font-medium'
                        : 'text-surface-600 hover:bg-surface-300 hover:text-white'
                    )}
                  >
                    Past {opt.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Stats row */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <StatTile label="New laws" value={stats.new_laws} icon={Gavel} color="bg-gold/10 text-gold" />
            <StatTile label="New verdicts" value={stats.new_verdicts} icon={Scale} color="bg-emerald/10 text-emerald" />
            <StatTile label="Challenges" value={stats.new_challenges} icon={Shield} color="bg-against-500/10 text-against-400" />
          </div>
        ) : null}

        {/* Category summary */}
        {!loading && stats && stats.categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {stats.categories.map(({ category, count }) => (
              <span
                key={category}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-200/60 border border-surface-300/60 text-xs text-surface-600"
              >
                {category}
                <span className="text-surface-500 font-mono">{count}</span>
              </span>
            ))}
          </div>
        )}

        {/* Sort controls */}
        <div
          className="flex gap-1.5 mb-5 overflow-x-auto pb-1 scrollbar-hide"
          role="group"
          aria-label="Sort laws by"
        >
          {SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSortKey(id)}
              aria-pressed={sortKey === id}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all',
                sortKey === id
                  ? 'bg-for-600/20 text-for-300 border border-for-500/30'
                  : 'bg-surface-200/60 text-surface-600 border border-surface-300/40 hover:text-white hover:border-surface-400'
              )}
            >
              <Icon className="h-3 w-3" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        {/* Law cards */}
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2, 3].map((i) => <LawCardSkeleton key={i} />)}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={Gavel}
            title="No new laws yet"
            description={`No laws were established in the past ${windowDays} days. Try expanding the time window.`}
            action={
              <button
                onClick={() => setWindowDays(90)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-600/20 text-for-300 hover:bg-for-600/30 transition-colors text-sm font-medium"
              >
                <Calendar className="h-4 w-4" aria-hidden="true" />
                Expand to 90 days
              </button>
            }
          />
        ) : (
          <div className="space-y-4">
            <AnimatePresence initial={false} mode="popLayout">
              {sorted.map((law) => (
                <LawCard key={law.id} law={law} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Footer nav */}
        {!loading && sorted.length > 0 && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-surface-300">
            <Link
              href="/law/health"
              className="flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors"
            >
              <BarChart2 className="h-4 w-4" aria-hidden="true" />
              Law Health Report
            </Link>
            <Link
              href="/law/verdicts"
              className="flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors"
            >
              Verdict Board
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
