'use client'

/**
 * /contrarian — The Maverick Tracker
 *
 * Shows the user's minority-position votes and whether those contrarian
 * stances are being vindicated over time.  Complements the Echo Chamber
 * Detector (/echo-chamber, which shows network-level groupthink) by
 * focusing on the user's own individual dissent vs. the whole platform.
 *
 * Sections:
 *  1. Maverick Score + summary stats
 *  2. Vindicating — minority positions trending toward 50/50
 *  3. Entrenched — strongly contrarian positions still far from majority
 *  4. Won — concluded debates where contrarian side prevailed
 *  5. Lost — concluded debates where the majority overruled them
 *  6. Category breakdown
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Gavel,
  RefreshCw,
  Scale,
  Shield,
  ShieldAlert,
  Swords,
  TrendingUp,
  Trophy,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ContrarianData, ContrarianVote } from '@/app/api/contrarian/route'

// ─── Category colors ──────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

function getCatColor(cat: string | null): string {
  return cat ? (CAT_COLOR[cat] ?? 'text-surface-500') : 'text-surface-500'
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_ICON: Record<string, typeof Zap> = {
  proposed: Zap,
  active: Zap,
  voting: Scale,
  law: Gavel,
  failed: XCircle,
  continued: Scale,
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
  continued: 'Continued',
}

const STATUS_CLASS: Record<string, string> = {
  proposed: 'text-surface-500 bg-surface-300/30 border-surface-400/30',
  active: 'text-for-300 bg-for-600/10 border-for-500/30',
  voting: 'text-purple bg-purple/10 border-purple/30',
  law: 'text-gold bg-gold/10 border-gold/30',
  failed: 'text-against-400 bg-against-600/10 border-against-500/30',
  continued: 'text-surface-500 bg-surface-300/30 border-surface-400/30',
}

// ─── Maverick Score gauge ─────────────────────────────────────────────────────

function MaverickGauge({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score))
  const label =
    pct >= 60 ? 'Maverick' : pct >= 35 ? 'Dissenter' : pct >= 15 ? 'Independent' : 'Conformist'
  const color =
    pct >= 60
      ? 'text-against-400'
      : pct >= 35
      ? 'text-purple'
      : pct >= 15
      ? 'text-gold'
      : 'text-emerald'
  const ringColor =
    pct >= 60 ? '#ef4444' : pct >= 35 ? '#8b5cf6' : pct >= 15 ? '#f59e0b' : '#10b981'

  const circumference = 2 * Math.PI * 40
  const dashOffset = circumference * (1 - pct / 100)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#24242e" strokeWidth="10" />
          <motion.circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={ringColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-2xl font-bold font-mono', color)}>{pct}</span>
          <span className="text-[10px] text-surface-500 uppercase tracking-wider">score</span>
        </div>
      </div>
      <span className={cn('text-sm font-semibold font-mono', color)}>{label}</span>
    </div>
  )
}

// ─── Vote card ─────────────────────────────────────────────────────────────────

function VoteCard({
  vote,
  accent,
}: {
  vote: ContrarianVote
  accent?: 'green' | 'red' | 'amber' | 'blue'
}) {
  const forPct = Math.round(vote.bluePct)
  const againstPct = 100 - forPct
  const userPct = vote.side === 'blue' ? forPct : againstPct
  const majorityPct = vote.side === 'blue' ? againstPct : forPct
  const catColor = getCatColor(vote.category)
  const StatusIcon = STATUS_ICON[vote.status] ?? Zap

  const accentBorder =
    accent === 'green'
      ? 'border-emerald/30 hover:border-emerald/60'
      : accent === 'red'
      ? 'border-against-500/30 hover:border-against-500/60'
      : accent === 'amber'
      ? 'border-gold/30 hover:border-gold/60'
      : 'border-surface-300 hover:border-for-500/30'

  const accentText =
    accent === 'green'
      ? 'text-emerald'
      : accent === 'red'
      ? 'text-against-400'
      : accent === 'amber'
      ? 'text-gold'
      : 'text-surface-500'

  return (
    <Link
      href={`/topic/${vote.topicId}`}
      className={cn(
        'block p-4 rounded-xl bg-surface-100 border transition-colors group',
        accentBorder
      )}
    >
      <div className="flex items-start gap-3">
        {/* Category + status */}
        <div className="flex-shrink-0 mt-0.5">
          <div
            className={cn(
              'h-8 w-8 rounded-lg flex items-center justify-center border',
              STATUS_CLASS[vote.status] ?? STATUS_CLASS.active
            )}
          >
            <StatusIcon className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>

        {/* Statement */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
            {vote.statement}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {vote.category && (
              <span className={cn('text-xs font-mono', catColor)}>{vote.category}</span>
            )}
            <span
              className={cn(
                'text-[11px] font-mono px-1.5 py-0.5 rounded border',
                STATUS_CLASS[vote.status] ?? STATUS_CLASS.active
              )}
            >
              {STATUS_LABEL[vote.status] ?? vote.status}
            </span>
          </div>
        </div>

        {/* Your side indicator */}
        <div className="flex-shrink-0 text-right min-w-[40px]">
          <div className={cn('text-xs font-mono', vote.side === 'blue' ? 'text-for-400' : 'text-against-400')}>
            {vote.side === 'blue' ? 'FOR' : 'AGN'}
          </div>
          <div className={cn('text-sm font-mono font-bold', vote.side === 'blue' ? 'text-for-400' : 'text-against-400')}>
            {userPct}%
          </div>
        </div>
      </div>

      {/* Vote bar — highlight user's side */}
      <div className="mt-3 space-y-1">
        <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
          <div
            className="h-full bg-for-500 rounded-full transition-all"
            style={{ width: `${forPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] font-mono">
          <span className="text-for-500">{forPct}% For</span>
          <span className={accentText}>
            {vote.gapFromMajority > 0
              ? `${vote.gapFromMajority}pt gap`
              : `You: ${userPct}% · Majority: ${majorityPct}%`}
          </span>
          <span className="text-against-500">{againstPct}% Against</span>
        </div>
      </div>
    </Link>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  count,
  expanded,
  onToggle,
}: {
  icon: typeof TrendingUp
  iconColor: string
  title: string
  subtitle: string
  count: number
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-3 mb-3 group"
      aria-expanded={expanded}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            'h-7 w-7 rounded-lg flex items-center justify-center',
            iconColor.replace('text-', 'bg-').replace(/(-\d+)/, '$1/10')
          )}
        >
          <Icon className={cn('h-3.5 w-3.5', iconColor)} aria-hidden="true" />
        </div>
        <div className="text-left">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-mono font-semibold text-white">{title}</h2>
            <span className="text-[11px] font-mono text-surface-500 bg-surface-300/40 px-1.5 py-0.5 rounded">
              {count}
            </span>
          </div>
          <p className="text-xs text-surface-500">{subtitle}</p>
        </div>
      </div>
      {expanded ? (
        <ChevronUp className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors flex-shrink-0" />
      ) : (
        <ChevronDown className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors flex-shrink-0" />
      )}
    </button>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ContrarianSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-full max-w-sm" />
            <Skeleton className="h-4 w-4/5 max-w-xs" />
          </div>
          <div className="flex-shrink-0">
            <Skeleton className="h-28 w-28 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-surface-200 rounded-xl p-3">
              <Skeleton className="h-3 w-16 mb-2" />
              <Skeleton className="h-6 w-12" />
            </div>
          ))}
        </div>
      </div>
      {[0, 1].map((s) => (
        <div key={s}>
          <Skeleton className="h-5 w-40 mb-3" />
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 p-4">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-4/5 mb-3" />
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ContrarianClient() {
  const [data, setData] = useState<ContrarianData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loggedIn, setLoggedIn] = useState(true)

  const [showVindicating, setShowVindicating] = useState(true)
  const [showEntrenched, setShowEntrenched] = useState(true)
  const [showWins, setShowWins] = useState(true)
  const [showLosses, setShowLosses] = useState(false)
  const [showCats, setShowCats] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/contrarian', { cache: 'no-store' })
      if (res.status === 401) {
        setLoggedIn(false)
        return
      }
      if (!res.ok) throw new Error('Failed to load contrarian data')
      const json = (await res.json()) as ContrarianData
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-14">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/analytics"
            className="flex-shrink-0 h-10 w-10 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center hover:border-surface-400 transition-colors"
            aria-label="Back to analytics"
          >
            <ArrowLeft className="h-4 w-4 text-surface-400" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="font-mono font-bold text-white text-xl leading-tight">
              Maverick Tracker
            </h1>
            <p className="text-xs text-surface-500 font-mono">
              Your minority positions — vindicated or overruled?
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto flex-shrink-0 h-8 w-8 rounded-lg border border-surface-300 bg-surface-200 flex items-center justify-center hover:border-surface-400 transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-3.5 w-3.5 text-surface-400', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Login gate */}
        {!loggedIn && (
          <EmptyState
            icon={Shield}
            title="Sign in to see your contrarian positions"
            description="Track which of your minority votes are gaining ground."
            action={{ label: 'Sign in', href: '/sign-in' }}
          />
        )}

        {/* Loading */}
        {loggedIn && loading && <ContrarianSkeleton />}

        {/* Error */}
        {loggedIn && !loading && error && (
          <EmptyState
            icon={ShieldAlert}
            title="Couldn't load your data"
            description={error}
            action={{ label: 'Try again', onClick: load }}
          />
        )}

        {/* No data */}
        {loggedIn && !loading && !error && data?.totalContrarian === 0 && (
          <div className="space-y-6">
            {/* Score card — zero state */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-surface-300 bg-surface-100 p-6 flex items-start gap-6"
            >
              <MaverickGauge score={data?.maverickScore ?? 0} />
              <div className="flex-1">
                <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-1">Maverick Score</p>
                <p className="text-sm text-white font-medium leading-relaxed">
                  {data?.insight ?? 'No contrarian positions yet.'}
                </p>
              </div>
            </motion.div>
            <EmptyState
              icon={Swords}
              title="No contrarian positions yet"
              description="Vote on more topics — when you find yourself in the minority, those positions will appear here."
              action={{ label: 'Browse topics', href: '/topics' }}
            />
          </div>
        )}

        {/* Main content */}
        {loggedIn && !loading && !error && data && data.totalContrarian > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Maverick Score card */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl border border-surface-300 bg-surface-100 p-6"
            >
              <div className="flex items-start gap-4">
                <MaverickGauge score={data.maverickScore} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-1">Maverick Score</p>
                  <p className="text-sm text-white leading-relaxed mb-3">
                    {data.insight}
                  </p>
                  {data.vindicationRate !== null && (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2
                        className={cn(
                          'h-3.5 w-3.5',
                          data.vindicationRate >= 50 ? 'text-emerald' : 'text-against-400'
                        )}
                        aria-hidden="true"
                      />
                      <span className="text-xs font-mono text-surface-400">
                        Vindication rate:{' '}
                        <span
                          className={cn(
                            'font-bold',
                            data.vindicationRate >= 50 ? 'text-emerald' : 'text-against-400'
                          )}
                        >
                          {data.vindicationRate}%
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5">
                {[
                  { label: 'Contrarian votes', value: data.totalContrarian.toString(), color: 'text-purple' },
                  { label: 'Still active', value: data.activeContrarian.toString(), color: 'text-for-400' },
                  { label: 'Vindicated', value: data.vindicated.toString(), color: 'text-emerald' },
                  { label: 'Overruled', value: data.overruled.toString(), color: 'text-against-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-surface-200 rounded-xl p-3 border border-surface-300">
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-1">{label}</p>
                    <p className={cn('text-xl font-bold font-mono', color)}>{value}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Vindicating section */}
            {data.vindicating.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <SectionHeader
                  icon={TrendingUp}
                  iconColor="text-emerald"
                  title="Gaining Ground"
                  subtitle="Your minority positions getting closer to 50/50"
                  count={data.vindicating.length}
                  expanded={showVindicating}
                  onToggle={() => setShowVindicating((v) => !v)}
                />
                <AnimatePresence>
                  {showVindicating && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2.5 overflow-hidden"
                    >
                      {data.vindicating.map((v) => (
                        <VoteCard key={v.topicId} vote={v} accent="green" />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>
            )}

            {/* Entrenched section */}
            {data.entrenched.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <SectionHeader
                  icon={Swords}
                  iconColor="text-against-400"
                  title="Deeply Contrarian"
                  subtitle="Strong minority positions — far from the majority"
                  count={data.entrenched.length}
                  expanded={showEntrenched}
                  onToggle={() => setShowEntrenched((v) => !v)}
                />
                <AnimatePresence>
                  {showEntrenched && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2.5 overflow-hidden"
                    >
                      {data.entrenched.map((v) => (
                        <VoteCard key={v.topicId} vote={v} accent="amber" />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>
            )}

            {/* Wins section */}
            {data.wins.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <SectionHeader
                  icon={Trophy}
                  iconColor="text-gold"
                  title="Vindicated"
                  subtitle="Concluded debates where your minority stance prevailed"
                  count={data.wins.length}
                  expanded={showWins}
                  onToggle={() => setShowWins((v) => !v)}
                />
                <AnimatePresence>
                  {showWins && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2.5 overflow-hidden"
                    >
                      {data.wins.map((v) => (
                        <VoteCard key={v.topicId} vote={v} accent="green" />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>
            )}

            {/* Losses section */}
            {data.losses.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <SectionHeader
                  icon={XCircle}
                  iconColor="text-against-400"
                  title="Overruled"
                  subtitle="Concluded debates where the majority prevailed"
                  count={data.losses.length}
                  expanded={showLosses}
                  onToggle={() => setShowLosses((v) => !v)}
                />
                <AnimatePresence>
                  {showLosses && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2.5 overflow-hidden"
                    >
                      {data.losses.map((v) => (
                        <VoteCard key={v.topicId} vote={v} accent="red" />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>
            )}

            {/* Category breakdown */}
            {data.categorySplits.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <SectionHeader
                  icon={BarChart2}
                  iconColor="text-purple"
                  title="By Category"
                  subtitle="Where your contrarian streak runs deepest"
                  count={data.categorySplits.length}
                  expanded={showCats}
                  onToggle={() => setShowCats((v) => !v)}
                />
                <AnimatePresence>
                  {showCats && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                      {data.categorySplits.map((cat) => {
                        const catColor = getCatColor(cat.category)
                        return (
                          <div
                            key={cat.category}
                            className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300"
                          >
                            <span className={cn('text-sm font-mono font-semibold w-28 flex-shrink-0', catColor)}>
                              {cat.category}
                            </span>
                            <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-purple rounded-full"
                                style={{ width: `${Math.min(100, (cat.count / Math.max(1, data.totalContrarian)) * 100 * 3)}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono text-surface-500 w-16 text-right flex-shrink-0">
                              {cat.count} vote{cat.count !== 1 ? 's' : ''}
                            </span>
                            {cat.vindicationRate !== null && (
                              <span
                                className={cn(
                                  'text-xs font-mono flex-shrink-0 w-12 text-right',
                                  cat.vindicationRate >= 50 ? 'text-emerald' : 'text-against-400'
                                )}
                              >
                                {cat.vindicationRate}%
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>
            )}

            {/* Footer links */}
            <div className="pt-2 border-t border-surface-300/60 flex flex-wrap gap-2">
              {[
                { label: 'Echo Chamber', href: '/echo-chamber', icon: Users },
                { label: 'Prescient', href: '/prescient', icon: Award },
                { label: 'Bias Check', href: '/bias-check', icon: Scale },
                { label: 'Browse Topics', href: '/topics', icon: ArrowRight },
              ].map(({ label, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium',
                    'bg-surface-200 border border-surface-300 text-surface-400',
                    'hover:border-surface-400 hover:text-white transition-colors'
                  )}
                >
                  <Icon className="h-3 w-3" aria-hidden="true" />
                  {label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
