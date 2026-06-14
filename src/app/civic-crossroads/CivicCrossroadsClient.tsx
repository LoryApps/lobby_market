'use client'

/**
 * /civic-crossroads — Weekly Civic Values Dilemma
 *
 * Each week a new fundamental civic values dilemma is presented:
 * two principles in direct tension. Users vote once. Results reveal
 * where the Lobby community stands on core philosophical divides.
 *
 * Distinct from:
 *   /civic-mirror  — vote on real topics, see majority alignment
 *   /quiz          — trivia and knowledge challenges
 *   /ballot        — formal topic voting
 *   /polls         — quick opinion polls
 *
 * This is about VALUES, not policy — abstract principles that underpin
 * all political positions.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Calendar,
  Check,
  ChevronRight,
  GitMerge,
  History,
  Loader2,
  Quote,
  RefreshCw,
  Scale,
  Share2,
  Sparkles,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { CrossroadsResponse } from '@/app/api/crossroads/route'
import type { ArchiveResponse } from '@/app/api/crossroads/archive/route'

// ─── Color maps ───────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; bar: string; hover: string; ring: string }> = {
  for: {
    bg: 'bg-for-600/10',
    border: 'border-for-500/40',
    text: 'text-for-400',
    bar: 'bg-for-500',
    hover: 'hover:border-for-400 hover:bg-for-600/20',
    ring: 'ring-for-500/60',
  },
  against: {
    bg: 'bg-against-600/10',
    border: 'border-against-500/40',
    text: 'text-against-400',
    bar: 'bg-against-500',
    hover: 'hover:border-against-400 hover:bg-against-600/20',
    ring: 'ring-against-500/60',
  },
  purple: {
    bg: 'bg-purple/10',
    border: 'border-purple/40',
    text: 'text-purple',
    bar: 'bg-purple',
    hover: 'hover:border-purple/60 hover:bg-purple/20',
    ring: 'ring-purple/60',
  },
  gold: {
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    text: 'text-gold',
    bar: 'bg-gold',
    hover: 'hover:border-gold/60 hover:bg-gold/20',
    ring: 'ring-gold/60',
  },
  emerald: {
    bg: 'bg-emerald/10',
    border: 'border-emerald/40',
    text: 'text-emerald',
    bar: 'bg-emerald',
    hover: 'hover:border-emerald/60 hover:bg-emerald/20',
    ring: 'ring-emerald/60',
  },
}

// ─── Result bar ───────────────────────────────────────────────────────────────

function ResultBar({
  pct,
  color,
  label,
  voted,
}: {
  pct: number
  color: string
  label: string
  voted: boolean
}) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.for
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-xs">
        <span className={cn('font-semibold', voted ? c.text : 'text-surface-500')}>{label}</span>
        <span className={cn('font-mono font-bold', voted ? c.text : 'text-surface-500')}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-surface-300/50 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', c.bar)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
    </div>
  )
}

// ─── Archive entry row ────────────────────────────────────────────────────────

function ArchiveRow({
  entry,
  isCurrent,
}: {
  entry: ArchiveResponse['entries'][number]
  isCurrent: boolean
}) {
  const { dilemma, stats, userVote } = entry
  const chosenValue = userVote === 'A' ? dilemma.valueA : userVote === 'B' ? dilemma.valueB : null
  const chosenColor = userVote === 'A' ? dilemma.colorA : dilemma.colorB
  const c = chosenColor ? (COLOR_MAP[chosenColor] ?? COLOR_MAP.for) : null

  return (
    <div className="flex items-center gap-3 py-3 border-b border-surface-200/40 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white truncate">{dilemma.title}</p>
        <p className="text-[11px] text-surface-500 truncate">
          {dilemma.valueA} vs {dilemma.valueB}
        </p>
      </div>
      {isCurrent && (
        <Badge variant="outline" className="text-[10px] shrink-0 text-purple border-purple/40">
          This week
        </Badge>
      )}
      {userVote && c ? (
        <span className={cn('text-[11px] font-semibold shrink-0 px-2 py-0.5 rounded-full', c.bg, c.text)}>
          {chosenValue}
        </span>
      ) : stats.totalVotes > 0 ? (
        <span className="text-[11px] text-surface-500 shrink-0">{stats.totalVotes} voted</span>
      ) : (
        <span className="text-[11px] text-surface-600 shrink-0">No votes</span>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CivicCrossroadsClient() {
  const [data, setData] = useState<CrossroadsResponse | null>(null)
  const [archive, setArchive] = useState<ArchiveResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [showArchive, setShowArchive] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [res, archRes] = await Promise.all([
        fetch('/api/crossroads'),
        fetch('/api/crossroads/archive'),
      ])
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as CrossroadsResponse
      setData(json)
      // If user already voted, reveal results immediately
      if (json.userVote) setRevealed(true)
      if (archRes.ok) {
        const archJson = await archRes.json() as ArchiveResponse
        setArchive(archJson)
      }
    } catch {
      setError('Could not load this week\'s Crossroads.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function castVote(choice: 'A' | 'B') {
    if (voting || !data || data.userVote) return
    setVoting(true)
    try {
      const res = await fetch('/api/crossroads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choice }),
      })
      if (res.status === 401) {
        window.location.href = '/login?next=/civic-crossroads'
        return
      }
      if (!res.ok && res.status !== 409) throw new Error('Vote failed')
      const json = await res.json() as { ok?: boolean; stats?: CrossroadsResponse['stats'] }
      if (json.stats) {
        setData((prev) => prev ? { ...prev, userVote: choice, stats: json.stats! } : prev)
      }
      setRevealed(true)
    } catch {
      setError('Could not cast your vote. Try again.')
    } finally {
      setVoting(false)
    }
  }

  async function share() {
    if (!data) return
    const { dilemma, stats, userVote } = data
    const choice = userVote === 'A' ? dilemma.valueA : dilemma.valueB
    const text = `This week's Civic Crossroads: "${dilemma.valueA} vs ${dilemma.valueB}"\n\nI chose ${choice}. ${stats.pctA}% picked ${dilemma.valueA}, ${stats.pctB}% picked ${dilemma.valueB}.\n\nWhere do you stand? lobby.market/civic-crossroads`
    if (navigator.share) {
      navigator.share({ text }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text).catch(() => {})
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-50">
        <TopBar />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 pb-24">
          <div className="space-y-6">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-52 rounded-2xl" />
              <Skeleton className="h-52 rounded-2xl" />
            </div>
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-50">
        <TopBar />
        <main className="flex-1 flex items-center justify-center px-4 pb-24">
          <div className="text-center space-y-3 max-w-xs">
            <p className="text-surface-500 text-sm">{error}</p>
            <button
              onClick={load}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 text-white text-sm hover:bg-surface-300 transition-colors mx-auto"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (!data) return null

  const { dilemma, stats, userVote } = data
  const cA = COLOR_MAP[dilemma.colorA] ?? COLOR_MAP.for
  const cB = COLOR_MAP[dilemma.colorB] ?? COLOR_MAP.against
  const hasVoted = Boolean(userVote)
  const majority = stats.pctA >= stats.pctB ? 'A' : 'B'
  const majorityLabel = majority === 'A' ? dilemma.valueA : dilemma.valueB
  const agreedWithMajority = userVote === majority

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-28">
        {/* ── Back + title ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-6">
          <Link
            href="/"
            className="p-2 rounded-lg hover:bg-surface-200 text-surface-500 hover:text-white transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-[11px] font-mono text-surface-500 uppercase tracking-widest">
              Civic Crossroads
            </p>
            <h1 className="text-lg font-bold text-white leading-tight">{dilemma.title}</h1>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] text-purple border-purple/40 hidden sm:flex">
              <Calendar className="h-3 w-3 mr-1" />
              Weekly
            </Badge>
            {hasVoted && (
              <button
                onClick={share}
                className="p-2 rounded-lg hover:bg-surface-200 text-surface-500 hover:text-white transition-colors"
                aria-label="Share"
              >
                <Share2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Scenario card ─────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 mb-6">
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5 h-8 w-8 rounded-lg bg-purple/20 flex items-center justify-center">
              <Scale className="h-4 w-4 text-purple" />
            </div>
            <div>
              <p className="text-xs font-semibold text-purple mb-1.5">The Scenario</p>
              <p className="text-sm text-surface-600 leading-relaxed">{dilemma.scenario}</p>
            </div>
          </div>
        </div>

        {/* ── Choice cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Side A */}
          <motion.button
            onClick={() => castVote('A')}
            disabled={hasVoted || voting}
            whileHover={!hasVoted ? { scale: 1.02 } : {}}
            whileTap={!hasVoted ? { scale: 0.98 } : {}}
            className={cn(
              'relative text-left rounded-2xl border p-4 transition-all duration-200 cursor-pointer',
              'disabled:cursor-default',
              cA.bg,
              cA.border,
              !hasVoted && cA.hover,
              userVote === 'A' && `ring-2 ring-offset-1 ring-offset-surface-100 ${cA.ring}`,
            )}
          >
            {userVote === 'A' && (
              <div className={cn('absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center', cA.bg)}>
                <Check className={cn('h-3 w-3', cA.text)} />
              </div>
            )}
            <p className={cn('text-xs font-mono font-bold mb-2 uppercase tracking-wider', cA.text)}>
              Option A
            </p>
            <p className="text-sm font-bold text-white mb-2 leading-tight">{dilemma.valueA}</p>
            <p className="text-[12px] text-surface-500 leading-relaxed">{dilemma.descA}</p>
            {voting && !userVote && (
              <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-surface-100/50">
                <Loader2 className="h-5 w-5 text-surface-500 animate-spin" />
              </div>
            )}
          </motion.button>

          {/* Side B */}
          <motion.button
            onClick={() => castVote('B')}
            disabled={hasVoted || voting}
            whileHover={!hasVoted ? { scale: 1.02 } : {}}
            whileTap={!hasVoted ? { scale: 0.98 } : {}}
            className={cn(
              'relative text-left rounded-2xl border p-4 transition-all duration-200 cursor-pointer',
              'disabled:cursor-default',
              cB.bg,
              cB.border,
              !hasVoted && cB.hover,
              userVote === 'B' && `ring-2 ring-offset-1 ring-offset-surface-100 ${cB.ring}`,
            )}
          >
            {userVote === 'B' && (
              <div className={cn('absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center', cB.bg)}>
                <Check className={cn('h-3 w-3', cB.text)} />
              </div>
            )}
            <p className={cn('text-xs font-mono font-bold mb-2 uppercase tracking-wider', cB.text)}>
              Option B
            </p>
            <p className="text-sm font-bold text-white mb-2 leading-tight">{dilemma.valueB}</p>
            <p className="text-[12px] text-surface-500 leading-relaxed">{dilemma.descB}</p>
            {voting && !userVote && (
              <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-surface-100/50">
                <Loader2 className="h-5 w-5 text-surface-500 animate-spin" />
              </div>
            )}
          </motion.button>
        </div>

        {/* ── Results reveal ────────────────────────────────────────────── */}
        <AnimatePresence>
          {revealed && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 mb-6 space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-surface-500" />
                  <p className="text-xs font-semibold text-surface-500">Community Split</p>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-surface-500">
                  <Users className="h-3.5 w-3.5" />
                  <span>{stats.totalVotes.toLocaleString()} {stats.totalVotes === 1 ? 'vote' : 'votes'}</span>
                </div>
              </div>

              {/* Bars */}
              <div className="space-y-3">
                <ResultBar
                  pct={stats.pctA}
                  color={dilemma.colorA}
                  label={dilemma.valueA}
                  voted={userVote === 'A'}
                />
                <ResultBar
                  pct={stats.pctB}
                  color={dilemma.colorB}
                  label={dilemma.valueB}
                  voted={userVote === 'B'}
                />
              </div>

              {/* Verdict message */}
              {userVote && stats.totalVotes > 0 && (
                <div className={cn(
                  'rounded-xl px-4 py-3 text-sm border',
                  agreedWithMajority
                    ? 'bg-emerald/10 border-emerald/30 text-emerald'
                    : 'bg-purple/10 border-purple/30 text-purple',
                )}>
                  {agreedWithMajority ? (
                    <>You stand with the majority &mdash; <strong>{stats.pctA >= stats.pctB ? stats.pctA : stats.pctB}%</strong> of the Lobby chose {majorityLabel}.</>
                  ) : (
                    <>You&apos;re in the minority &mdash; only <strong>{userVote === 'A' ? stats.pctA : stats.pctB}%</strong> chose {userVote === 'A' ? dilemma.valueA : dilemma.valueB}.</>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Prompt to vote (unauthenticated or pre-vote) ──────────────── */}
        {!revealed && !hasVoted && (
          <div className="text-center mb-6">
            <p className="text-xs text-surface-600">
              Choose a side to see where the Lobby stands.
            </p>
          </div>
        )}

        {/* ── Quote ─────────────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-surface-100/50 border border-surface-300/40 p-5 mb-6">
          <Quote className="h-5 w-5 text-surface-500 mb-2" />
          <p className="text-sm text-surface-600 italic leading-relaxed mb-2">
            &ldquo;{dilemma.quote}&rdquo;
          </p>
          <p className="text-xs text-surface-500 font-medium">— {dilemma.quoteAuthor}</p>
        </div>

        {/* ── Archive toggle ────────────────────────────────────────────── */}
        {archive && archive.entries.length > 1 && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300/60 overflow-hidden">
            <button
              onClick={() => setShowArchive((s) => !s)}
              className="w-full flex items-center justify-between p-4 hover:bg-surface-200/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-surface-500" />
                <span className="text-sm font-semibold text-white">Past Crossroads</span>
              </div>
              <motion.div
                animate={{ rotate: showArchive ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight className="h-4 w-4 text-surface-500" />
              </motion.div>
            </button>

            <AnimatePresence>
              {showArchive && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 border-t border-surface-200/40">
                    {archive.entries.map((entry) => (
                      <ArchiveRow
                        key={entry.dilemma.id}
                        entry={entry}
                        isCurrent={entry.dilemma.id === archive.currentDilemmaId}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── Related ───────────────────────────────────────────────────── */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link
            href="/civic-mirror"
            className="flex items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-surface-400/60 transition-colors group"
          >
            <div className="h-7 w-7 rounded-lg bg-for-600/20 flex items-center justify-center shrink-0">
              <Vote className="h-3.5 w-3.5 text-for-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white">Civic Mirror</p>
              <p className="text-[11px] text-surface-500 truncate">5 topics, daily</p>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-surface-600 ml-auto shrink-0 group-hover:text-surface-400 transition-colors" />
          </Link>

          <Link
            href="/civic-decoder"
            className="flex items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-surface-400/60 transition-colors group"
          >
            <div className="h-7 w-7 rounded-lg bg-purple/20 flex items-center justify-center shrink-0">
              <Zap className="h-3.5 w-3.5 text-purple" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white">Civic Decoder</p>
              <p className="text-[11px] text-surface-500 truncate">Guess the topic</p>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-surface-600 ml-auto shrink-0 group-hover:text-surface-400 transition-colors" />
          </Link>

          <Link
            href="/analytics/compass"
            className="flex items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-surface-400/60 transition-colors group"
          >
            <div className="h-7 w-7 rounded-lg bg-gold/20 flex items-center justify-center shrink-0">
              <GitMerge className="h-3.5 w-3.5 text-gold" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white">Civic Compass</p>
              <p className="text-[11px] text-surface-500 truncate">Your 8-axis radar</p>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-surface-600 ml-auto shrink-0 group-hover:text-surface-400 transition-colors" />
          </Link>

          <Link
            href="/archetype"
            className="flex items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-surface-400/60 transition-colors group"
          >
            <div className="h-7 w-7 rounded-lg bg-emerald/20 flex items-center justify-center shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-emerald" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white">Archetype</p>
              <p className="text-[11px] text-surface-500 truncate">Your civic identity</p>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-surface-600 ml-auto shrink-0 group-hover:text-surface-400 transition-colors" />
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
