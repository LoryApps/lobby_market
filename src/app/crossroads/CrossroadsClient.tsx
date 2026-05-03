'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronDown,
  History,
  Loader2,
  Quote,
  RefreshCw,
  Scale,
  Sparkles,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { CrossroadsResponse, CrossroadsStats } from '@/app/api/crossroads/route'

// ─── Color helpers ─────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; glow: string; bar: string }> = {
  for: {
    bg: 'bg-for-500/10 hover:bg-for-500/20',
    border: 'border-for-500/40 hover:border-for-500/70',
    text: 'text-for-300',
    glow: 'shadow-for-500/20',
    bar: 'bg-for-500',
  },
  against: {
    bg: 'bg-against-500/10 hover:bg-against-500/20',
    border: 'border-against-500/40 hover:border-against-500/70',
    text: 'text-against-300',
    glow: 'shadow-against-500/20',
    bar: 'bg-against-500',
  },
  gold: {
    bg: 'bg-gold/10 hover:bg-gold/20',
    border: 'border-gold/40 hover:border-gold/70',
    text: 'text-gold',
    glow: 'shadow-gold/20',
    bar: 'bg-gold',
  },
  emerald: {
    bg: 'bg-emerald/10 hover:bg-emerald/20',
    border: 'border-emerald/40 hover:border-emerald/70',
    text: 'text-emerald',
    glow: 'shadow-emerald/20',
    bar: 'bg-emerald',
  },
  purple: {
    bg: 'bg-purple/10 hover:bg-purple/20',
    border: 'border-purple/40 hover:border-purple/70',
    text: 'text-purple',
    glow: 'shadow-purple/20',
    bar: 'bg-purple',
  },
}

function getColor(key: string) {
  return COLOR_MAP[key] ?? COLOR_MAP.for
}

// ─── Choice card ───────────────────────────────────────────────────────────────

interface ChoiceCardProps {
  label: 'A' | 'B'
  value: string
  desc: string
  colorKey: string
  chosen: boolean
  locked: boolean
  onChoose: (c: 'A' | 'B') => void
  pct: number
  count: number
  revealed: boolean
}

function ChoiceCard({
  label,
  value,
  desc,
  colorKey,
  chosen,
  locked,
  onChoose,
  pct,
  count,
  revealed,
}: ChoiceCardProps) {
  const c = getColor(colorKey)

  return (
    <motion.button
      onClick={() => !locked && onChoose(label)}
      disabled={locked}
      whileHover={locked ? {} : { scale: 1.02, y: -2 }}
      whileTap={locked ? {} : { scale: 0.98 }}
      className={cn(
        'relative w-full text-left rounded-2xl border-2 p-6 transition-all duration-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-for-400',
        locked ? 'cursor-default' : 'cursor-pointer',
        chosen
          ? cn('border-opacity-100', c.border.replace('hover:', ''), c.bg.replace('hover:', ''), 'shadow-lg', c.glow)
          : cn(c.bg, c.border),
      )}
      aria-pressed={chosen}
      aria-label={`Choose ${value}`}
    >
      {/* Chosen badge */}
      <AnimatePresence>
        {chosen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute -top-3 -right-3 bg-surface-900 border border-surface-400 rounded-full px-2 py-0.5 text-xs font-mono font-bold text-white"
          >
            Your choice
          </motion.div>
        )}
      </AnimatePresence>

      {/* Value name */}
      <div className={cn('font-mono text-3xl font-black mb-2', c.text)}>
        {value}
      </div>

      {/* Description */}
      <p className="text-sm font-mono text-surface-400 leading-relaxed mb-4">
        {desc}
      </p>

      {/* Results bar — shown after voting */}
      <AnimatePresence>
        {revealed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={cn('text-2xl font-black font-mono', c.text)}>
                <AnimatedNumber value={pct} />%
              </span>
              <span className="text-xs font-mono text-surface-500">
                {count.toLocaleString()} {count === 1 ? 'vote' : 'votes'}
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                className={cn('h-full rounded-full', c.bar)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

// ─── VS divider ────────────────────────────────────────────────────────────────

function VsDivider() {
  return (
    <div className="flex items-center justify-center py-2 md:py-0 md:px-2 flex-shrink-0">
      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-surface-200 border border-surface-400">
        <Scale className="h-4 w-4 text-surface-500" />
      </div>
    </div>
  )
}

// ─── History row ───────────────────────────────────────────────────────────────

interface HistoryEntry {
  dilemmaId: string
  choice: 'A' | 'B'
}

function HistorySection({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="mt-8 rounded-2xl bg-surface-100 border border-surface-300 p-5"
    >
      <h3 className="font-mono text-sm font-bold text-surface-400 uppercase tracking-wider mb-3">
        Your Crossroads History
      </h3>
      <div className="flex flex-wrap gap-2">
        {history.map((h) => (
          <span
            key={h.dilemmaId}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-mono font-semibold border',
              h.choice === 'A'
                ? 'bg-for-500/10 border-for-500/30 text-for-300'
                : 'bg-against-500/10 border-against-500/30 text-against-300',
            )}
          >
            {h.dilemmaId.replace(/-/g, ' ')} → {h.choice === 'A' ? 'A' : 'B'}
          </span>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CrossroadsSkeleton() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-8 pb-24 md:pb-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-surface-200 rounded-lg" />
          <div className="h-16 w-full bg-surface-200 rounded-2xl" />
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 h-48 bg-surface-200 rounded-2xl" />
            <div className="h-10 w-10 bg-surface-200 rounded-full self-center" />
            <div className="flex-1 h-48 bg-surface-200 rounded-2xl" />
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function CrossroadsClient() {
  const [data, setData] = useState<CrossroadsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [localVote, setLocalVote] = useState<'A' | 'B' | null>(null)
  const [localStats, setLocalStats] = useState<CrossroadsStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/crossroads', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json: CrossroadsResponse = await res.json()
      setData(json)
      if (json.userVote) {
        setLocalVote(json.userVote)
        setRevealed(true)
      }
    } catch {
      setError('Could not load the Crossroads. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleChoose = useCallback(async (choice: 'A' | 'B') => {
    if (!data || localVote || voting) return
    setVoting(true)

    // Optimistic update
    setLocalVote(choice)
    setRevealed(true)

    try {
      const res = await fetch('/api/crossroads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choice }),
      })
      if (!res.ok) {
        if (res.status === 401) {
          // Not logged in — still show results optimistically with existing stats
          setLocalStats(data.stats)
          return
        }
        const err = await res.json()
        throw new Error(err.error ?? 'Vote failed')
      }
      const { stats } = await res.json()
      setLocalStats(stats)
    } catch {
      // Show existing stats on error
      setLocalStats(data.stats)
    } finally {
      setVoting(false)
    }
  }, [data, localVote, voting])

  if (loading) return <CrossroadsSkeleton />

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col">
        <TopBar />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center space-y-4">
            <Scale className="h-12 w-12 text-surface-500 mx-auto" />
            <p className="text-surface-400 font-mono text-sm">{error ?? 'Something went wrong.'}</p>
            <button
              onClick={load}
              className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg bg-surface-200 text-surface-400 text-sm font-mono hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  const { dilemma, stats: rawStats, userVote, history } = data
  const displayStats = localStats ?? rawStats
  const activeVote = localVote ?? userVote
  const isLocked = !!activeVote

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Back link ───────────────────────────────────────────────── */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to feed
        </Link>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple/10 border border-purple/30">
              <Scale className="h-5 w-5 text-purple" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-mono text-xl font-black text-white">
                  The Civic Crossroads
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-purple/10 border border-purple/30 text-purple text-xs font-mono font-semibold">
                  Weekly
                </span>
              </div>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                {dilemma.title} · Two values. One choice.
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Scenario ────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6"
        >
          <p className="font-mono text-sm text-surface-300 leading-relaxed">
            <span className="text-surface-500 font-bold uppercase tracking-wider text-xs block mb-2">
              This Week&rsquo;s Scenario
            </span>
            {dilemma.scenario}
          </p>
        </motion.div>

        {/* ── Choice cards ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-col md:flex-row gap-4 mb-6"
        >
          <div className="flex-1">
            <ChoiceCard
              label="A"
              value={dilemma.valueA}
              desc={dilemma.descA}
              colorKey={dilemma.colorA}
              chosen={activeVote === 'A'}
              locked={isLocked}
              onChoose={handleChoose}
              pct={displayStats.pctA}
              count={displayStats.countA}
              revealed={revealed}
            />
          </div>

          <VsDivider />

          <div className="flex-1">
            <ChoiceCard
              label="B"
              value={dilemma.valueB}
              desc={dilemma.descB}
              colorKey={dilemma.colorB}
              chosen={activeVote === 'B'}
              locked={isLocked}
              onChoose={handleChoose}
              pct={displayStats.pctB}
              count={displayStats.countB}
              revealed={revealed}
            />
          </div>
        </motion.div>

        {/* ── Pre-vote hint ───────────────────────────────────────────── */}
        <AnimatePresence>
          {!isLocked && !voting && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-xs font-mono text-surface-500 mb-6"
            >
              Choose the value that matters most to you in this scenario
            </motion.p>
          )}
          {voting && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2 mb-6 text-surface-400 font-mono text-sm"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              Recording your choice…
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Results summary (post-vote) ──────────────────────────────── */}
        <AnimatePresence>
          {revealed && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6"
            >
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-surface-400" />
                <span className="font-mono text-sm font-bold text-surface-300">
                  Community split
                </span>
                <span className="ml-auto text-xs font-mono text-surface-500">
                  <AnimatedNumber value={displayStats.totalVotes} /> total
                </span>
              </div>

              {/* Combined bar */}
              <div className="h-3 rounded-full overflow-hidden flex mb-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${displayStats.pctA}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={cn(
                    'h-full',
                    getColor(dilemma.colorA).bar,
                  )}
                />
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${displayStats.pctB}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.05 }}
                  className={cn(
                    'h-full',
                    getColor(dilemma.colorB).bar,
                  )}
                />
              </div>

              <div className="flex justify-between text-xs font-mono">
                <span className={cn('font-bold', getColor(dilemma.colorA).text)}>
                  {dilemma.valueA} {displayStats.pctA}%
                </span>
                <span className={cn('font-bold', getColor(dilemma.colorB).text)}>
                  {displayStats.pctB}% {dilemma.valueB}
                </span>
              </div>

              {/* Verdict */}
              <div className="mt-4 pt-4 border-t border-surface-300">
                {displayStats.pctA > displayStats.pctB ? (
                  <p className="text-xs font-mono text-surface-400">
                    <span className={cn('font-bold', getColor(dilemma.colorA).text)}>
                      {dilemma.valueA}
                    </span>{' '}
                    leads — the Lobby leans toward{' '}
                    {displayStats.pctA >= 70 ? 'a strong majority' : displayStats.pctA >= 60 ? 'a clear majority' : 'a slim majority'}{' '}
                    choosing it.
                  </p>
                ) : displayStats.pctB > displayStats.pctA ? (
                  <p className="text-xs font-mono text-surface-400">
                    <span className={cn('font-bold', getColor(dilemma.colorB).text)}>
                      {dilemma.valueB}
                    </span>{' '}
                    leads — the Lobby leans toward{' '}
                    {displayStats.pctB >= 70 ? 'a strong majority' : displayStats.pctB >= 60 ? 'a clear majority' : 'a slim majority'}{' '}
                    choosing it.
                  </p>
                ) : (
                  <p className="text-xs font-mono text-surface-400">
                    The Lobby is <span className="text-white font-bold">perfectly split</span> — the most contested dilemma yet.
                  </p>
                )}
              </div>

              {/* Explore related topics */}
              <div className="mt-4 pt-4 border-t border-surface-300 flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-surface-500" />
                <span className="text-xs font-mono text-surface-500">
                  Explore the debate behind this tension on the feed
                </span>
                <Link
                  href="/"
                  className="ml-auto text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
                >
                  Open feed →
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Quote ───────────────────────────────────────────────────── */}
        <motion.blockquote
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6"
        >
          <Quote className="h-4 w-4 text-surface-500 mb-3" />
          <p className="font-mono text-sm text-surface-300 italic leading-relaxed mb-3">
            &ldquo;{dilemma.quote}&rdquo;
          </p>
          <footer className="text-xs font-mono text-surface-500">
            — {dilemma.quoteAuthor}
          </footer>
        </motion.blockquote>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <motion.details
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden mb-6 group"
        >
          <summary className="flex items-center justify-between p-5 cursor-pointer list-none select-none">
            <span className="font-mono text-sm font-bold text-surface-300">
              How the Crossroads works
            </span>
            <ChevronDown className="h-4 w-4 text-surface-500 group-open:rotate-180 transition-transform" />
          </summary>
          <div className="px-5 pb-5 space-y-2 text-xs font-mono text-surface-400 leading-relaxed border-t border-surface-300 pt-4">
            <p>
              Every week, a new civic dilemma is presented — two fundamental values in direct tension.
              There is no objectively correct answer, only your answer.
            </p>
            <p>
              Your choice is permanent for that week. Results are revealed immediately after you choose,
              showing how the community split.
            </p>
            <p>
              The Crossroads cycles through 8 fundamental tensions: Freedom vs Safety, Prosperity vs Planet,
              Equality vs Merit, Tradition vs Progress, and more.
            </p>
            <p>
              A new dilemma arrives every Monday. Your history is recorded so you can track your civic values
              profile over time.
            </p>
          </div>
        </motion.details>

        {/* ── User history ─────────────────────────────────────────────── */}
        <HistorySection history={history} />

        {/* ── Explore more ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          <Link
            href="/crossroads/archive"
            className="flex items-center gap-2 p-4 rounded-xl bg-surface-100 border border-purple/30 hover:border-purple/60 transition-colors"
          >
            <History className="h-4 w-4 text-purple" />
            <div>
              <div className="text-xs font-mono font-bold text-surface-300">Values Vault</div>
              <div className="text-xs font-mono text-surface-500">All 8 dilemmas</div>
            </div>
          </Link>
          <Link
            href="/compass"
            className="flex items-center gap-2 p-4 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
          >
            <Scale className="h-4 w-4 text-purple" />
            <div>
              <div className="text-xs font-mono font-bold text-surface-300">Civic Compass</div>
              <div className="text-xs font-mono text-surface-500">Your values map</div>
            </div>
          </Link>
          <Link
            href="/spectrum"
            className="flex items-center gap-2 p-4 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
          >
            <Sparkles className="h-4 w-4 text-gold" />
            <div>
              <div className="text-xs font-mono font-bold text-surface-300">Spectrum</div>
              <div className="text-xs font-mono text-surface-500">Opinion landscape</div>
            </div>
          </Link>
        </motion.div>

      </main>

      <BottomNav />
    </div>
  )
}
