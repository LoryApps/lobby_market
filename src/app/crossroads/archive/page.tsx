'use client'

/**
 * /crossroads/archive — The Values Vault
 *
 * Browse every Civic Crossroads dilemma ever presented — with community
 * results and your own choices highlighted. The full archive of how the
 * Lobby has answered its hardest civic questions.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock,
  RefreshCw,
  Scale,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { DilemmaArchiveEntry, ArchiveResponse } from '@/app/api/crossroads/archive/route'

// ─── Color helpers ─────────────────────────────────────────────────────────────

const COLOR_MAP: Record<
  string,
  { bg: string; border: string; text: string; bar: string; pill: string }
> = {
  for: {
    bg: 'bg-for-500/10',
    border: 'border-for-500/40',
    text: 'text-for-300',
    bar: 'bg-for-500',
    pill: 'bg-for-500/20 border-for-500/40 text-for-300',
  },
  against: {
    bg: 'bg-against-500/10',
    border: 'border-against-500/40',
    text: 'text-against-300',
    bar: 'bg-against-500',
    pill: 'bg-against-500/20 border-against-500/40 text-against-300',
  },
  gold: {
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    text: 'text-gold',
    bar: 'bg-gold',
    pill: 'bg-gold/20 border-gold/40 text-gold',
  },
  emerald: {
    bg: 'bg-emerald/10',
    border: 'border-emerald/40',
    text: 'text-emerald',
    bar: 'bg-emerald',
    pill: 'bg-emerald/20 border-emerald/40 text-emerald',
  },
  purple: {
    bg: 'bg-purple/10',
    border: 'border-purple/40',
    text: 'text-purple',
    bar: 'bg-purple',
    pill: 'bg-purple/20 border-purple/40 text-purple',
  },
}

function getColor(key: string) {
  return COLOR_MAP[key] ?? COLOR_MAP.for
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtVotes(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString()
}

// ─── Values Breakdown bar ─────────────────────────────────────────────────────

function ValuesBar({
  pctA,
  pctB,
  colorA,
  colorB,
  valueA,
  valueB,
  userVote,
}: {
  pctA: number
  pctB: number
  colorA: string
  colorB: string
  valueA: string
  valueB: string
  userVote: 'A' | 'B' | null
}) {
  const cA = getColor(colorA)
  const cB = getColor(colorB)
  const forW = pctA > 0 && pctA < 3 ? 3 : pctA
  const agnW = pctB > 0 && pctB < 3 ? 3 : pctB

  return (
    <div className="space-y-2">
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5 bg-surface-300">
        <div
          className={cn('h-full rounded-l-full transition-all duration-700', cA.bar)}
          style={{ width: `${forW}%` }}
        />
        <div
          className={cn('h-full rounded-r-full transition-all duration-700 ml-auto', cB.bar)}
          style={{ width: `${agnW}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={cn('text-sm font-mono font-bold', cA.text)}>
            {pctA}%
          </span>
          <span className="text-xs font-mono text-surface-500">{valueA}</span>
          {userVote === 'A' && (
            <span className={cn('text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full border', cA.pill)}>
              Your choice
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {userVote === 'B' && (
            <span className={cn('text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full border', cB.pill)}>
              Your choice
            </span>
          )}
          <span className="text-xs font-mono text-surface-500">{valueB}</span>
          <span className={cn('text-sm font-mono font-bold', cB.text)}>
            {pctB}%
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Dilemma card ─────────────────────────────────────────────────────────────

function DilemmaCard({ entry }: { entry: DilemmaArchiveEntry }) {
  const { dilemma, stats, userVote, isCurrent } = entry
  const [expanded, setExpanded] = useState(false)
  const cA = getColor(dilemma.colorA)
  const cB = getColor(dilemma.colorB)
  const hasVoted = userVote !== null
  const hasVotes = stats.totalVotes > 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border bg-surface-100 overflow-hidden transition-colors',
        isCurrent
          ? 'border-purple/50 ring-1 ring-purple/20'
          : 'border-surface-300/60 hover:border-surface-400/60',
      )}
    >
      <div className="p-5 space-y-4">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              {isCurrent && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-purple bg-purple/10 border border-purple/30 px-2 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple animate-pulse" />
                  This week
                </span>
              )}
              {hasVoted && !isCurrent && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald bg-emerald/10 border border-emerald/30 px-2 py-0.5 rounded-full">
                  Participated
                </span>
              )}
              {!hasVoted && !isCurrent && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-500 bg-surface-200 border border-surface-300 px-2 py-0.5 rounded-full">
                  Missed
                </span>
              )}
            </div>
            <h3 className="font-mono text-base font-bold text-white leading-snug">
              {dilemma.title}
            </h3>
          </div>

          {/* Value pills */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className={cn('text-xs font-mono font-bold px-2 py-0.5 rounded-full border', cA.pill)}>
              {dilemma.valueA}
            </span>
            <span className="text-surface-600 text-xs font-mono">vs</span>
            <span className={cn('text-xs font-mono font-bold px-2 py-0.5 rounded-full border', cB.pill)}>
              {dilemma.valueB}
            </span>
          </div>
        </div>

        {/* ── Results / no votes placeholder ─────────────────────── */}
        {hasVotes ? (
          <ValuesBar
            pctA={stats.pctA}
            pctB={stats.pctB}
            colorA={dilemma.colorA}
            colorB={dilemma.colorB}
            valueA={dilemma.valueA}
            valueB={dilemma.valueB}
            userVote={userVote}
          />
        ) : (
          <div className="flex items-center gap-2 text-xs font-mono text-surface-500">
            <Users className="h-3.5 w-3.5" />
            No votes yet — be the first to choose
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
            <Users className="h-3 w-3" />
            <span>{fmtVotes(stats.totalVotes)} votes cast</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded((p) => !p)}
              className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse scenario' : 'Read scenario'}
            >
              {expanded ? (
                <>Less <ChevronUp className="h-3.5 w-3.5" /></>
              ) : (
                <>Read scenario <ChevronDown className="h-3.5 w-3.5" /></>
              )}
            </button>

            {isCurrent && (
              <Link
                href="/crossroads"
                className="flex items-center gap-1 text-xs font-mono font-semibold text-purple hover:text-purple/80 transition-colors"
              >
                Vote now <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>

        {/* ── Expandable scenario ──────────────────────────────────── */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-1 space-y-3 border-t border-surface-300">
                <p className="text-xs font-mono text-surface-400 leading-relaxed pt-3">
                  {dilemma.scenario}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className={cn('rounded-lg border p-3', cA.bg, cA.border)}>
                    <p className={cn('text-xs font-mono font-bold mb-1', cA.text)}>{dilemma.valueA}</p>
                    <p className="text-[11px] font-mono text-surface-400 leading-relaxed">{dilemma.descA}</p>
                  </div>
                  <div className={cn('rounded-lg border p-3', cB.bg, cB.border)}>
                    <p className={cn('text-xs font-mono font-bold mb-1', cB.text)}>{dilemma.valueB}</p>
                    <p className="text-[11px] font-mono text-surface-400 leading-relaxed">{dilemma.descB}</p>
                  </div>
                </div>
                <blockquote className="rounded-lg bg-surface-200 border border-surface-300 p-3">
                  <p className="text-xs font-mono text-surface-400 italic leading-relaxed mb-1">
                    &ldquo;{dilemma.quote}&rdquo;
                  </p>
                  <footer className="text-[11px] font-mono text-surface-500">
                    — {dilemma.quoteAuthor}
                  </footer>
                </blockquote>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-5 w-3/4" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3.5 w-20" />
      </div>
    </div>
  )
}

// ─── Values summary pill ──────────────────────────────────────────────────────

function ValuesSummary({ entries }: { entries: DilemmaArchiveEntry[] }) {
  const voted = entries.filter((e) => e.userVote !== null)
  if (voted.length === 0) return null

  // Count how many times each value was chosen (by label)
  const valueCount: Record<string, { count: number; color: string }> = {}
  for (const e of voted) {
    const chosen = e.userVote === 'A'
      ? { val: e.dilemma.valueA, color: e.dilemma.colorA }
      : { val: e.dilemma.valueB, color: e.dilemma.colorB }
    if (!valueCount[chosen.val]) valueCount[chosen.val] = { count: 0, color: chosen.color }
    valueCount[chosen.val].count += 1
  }

  const sorted = Object.entries(valueCount).sort((a, b) => b[1].count - a[1].count)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-6"
    >
      <h2 className="font-mono text-xs font-semibold text-surface-500 uppercase tracking-widest mb-3">
        Your Value Profile — {voted.length} of {entries.length} dilemmas
      </h2>
      <div className="flex flex-wrap gap-2">
        {sorted.map(([val, { count, color }]) => {
          const c = getColor(color)
          return (
            <span
              key={val}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-mono font-bold',
                c.pill,
              )}
            >
              {val}
              <span className={cn('text-[10px] opacity-70')}>×{count}</span>
            </span>
          )
        })}
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CrossroadsArchivePage() {
  const [entries, setEntries] = useState<DilemmaArchiveEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/crossroads/archive')
      if (!res.ok) throw new Error('failed')
      const data = (await res.json()) as ArchiveResponse
      setEntries(data.entries)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const votedCount = entries.filter((e) => e.userVote !== null).length
  const totalVotesAcrossAll = entries.reduce((s, e) => s + e.stats.totalVotes, 0)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="mb-8">
          <Link
            href="/crossroads"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Crossroads
          </Link>

          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
              <Scale className="h-5 w-5 text-purple" aria-hidden />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">The Values Vault</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">Every Civic Crossroads, ever</p>
            </div>
          </div>

          <p className="text-sm font-mono text-surface-400 leading-relaxed">
            Eight fundamental value tensions. Each week, the Lobby chooses. Browse every dilemma,
            see how the community split, and track your own civic values profile over time.
          </p>

          {/* ── Stats row ──────────────────────────────────────────── */}
          {!loading && entries.length > 0 && (
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-surface-300 bg-surface-100 px-4 py-3 text-center">
                <div className="font-mono text-xl font-bold text-white">{entries.length}</div>
                <div className="text-[10px] font-mono text-surface-500 mt-0.5">Dilemmas</div>
              </div>
              <div className="rounded-xl border border-surface-300 bg-surface-100 px-4 py-3 text-center">
                <div className="font-mono text-xl font-bold text-white">
                  {totalVotesAcrossAll.toLocaleString()}
                </div>
                <div className="text-[10px] font-mono text-surface-500 mt-0.5">Total votes</div>
              </div>
              <div className="rounded-xl border border-surface-300 bg-surface-100 px-4 py-3 text-center">
                <div className={cn(
                  'font-mono text-xl font-bold',
                  votedCount === entries.length ? 'text-emerald' : 'text-white',
                )}>
                  {votedCount}/{entries.length}
                </div>
                <div className="text-[10px] font-mono text-surface-500 mt-0.5">Your votes</div>
              </div>
            </div>
          )}
        </div>

        {/* ── Values summary ──────────────────────────────────────────── */}
        {!loading && <ValuesSummary entries={entries} />}

        {/* ── Cards ──────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={<Zap className="h-6 w-6 text-against-400" />}
            title="Couldn't load archive"
            description="Something went wrong. Try refreshing."
            action={
              <button
                onClick={load}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            }
          />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<Scale className="h-6 w-6 text-purple" />}
            title="No dilemmas yet"
            description="The first Crossroads is coming soon."
          />
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <DilemmaCard key={entry.dilemma.id} entry={entry} />
            ))}
          </div>
        )}

        {/* ── Footer CTA ──────────────────────────────────────────────── */}
        {!loading && !error && entries.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-10 rounded-2xl border border-purple/20 bg-purple/5 p-6 text-center"
          >
            <Clock className="h-5 w-5 text-purple mx-auto mb-3" />
            <h2 className="font-mono text-base font-bold text-white mb-1">
              A new dilemma every week
            </h2>
            <p className="text-xs font-mono text-surface-500 mb-4">
              The cycle repeats every 8 weeks. Keep coming back to build your complete values profile.
            </p>
            <Link
              href="/crossroads"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple hover:bg-purple/90 text-white text-sm font-mono font-semibold transition-colors"
            >
              This week&apos;s dilemma
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
