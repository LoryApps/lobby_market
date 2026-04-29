'use client'

/**
 * /debate/my-record — Personal Debate Record
 *
 * Shows the current user's full debate history: total debates participated,
 * speaker vs spectator split, sway earned, win/loss record, and a list of
 * every debate with its outcome.
 *
 * "Win" = the topic you argued FOR became law, or the topic you argued
 * AGAINST failed. Ties / active topics show no outcome yet.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Mic,
  RefreshCw,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { DebateRecord, DebateRecordStats, DebateRecordResponse } from '@/app/api/me/debate-record/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function truncate(s: string, max = 80): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

// ─── Debate type label ────────────────────────────────────────────────────────

const DEBATE_TYPE_LABEL: Record<string, string> = {
  quick: 'Quick',
  grand: 'Grand',
  tribunal: 'Tribunal',
}

const DEBATE_TYPE_COLOR: Record<string, string> = {
  quick: 'text-for-400 border-for-500/30 bg-for-500/10',
  grand: 'text-gold border-gold/30 bg-gold/10',
  tribunal: 'text-purple border-purple/30 bg-purple/10',
}

// ─── Category colors ──────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
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

// ─── Win-rate ring ────────────────────────────────────────────────────────────

function WinRateRing({ pct }: { pct: number }) {
  const r = 26
  const circ = 2 * Math.PI * r
  const filled = (pct / 100) * circ
  const color =
    pct >= 70 ? '#10b981' : // emerald
    pct >= 50 ? '#60a5fa' : // for-400
    pct >= 35 ? '#f59e0b' : // gold
               '#f87171'   // against

  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 64, height: 64 }}>
      <svg width="64" height="64" className="-rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="5" />
        <motion.circle
          cx="32" cy="32" r={r} fill="none"
          stroke={color} strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - filled }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <span className="absolute text-sm font-mono font-bold text-white">{pct}%</span>
    </div>
  )
}

// ─── Stats card ───────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  sub,
}: {
  icon: typeof Mic
  iconColor: string
  iconBg: string
  label: string
  value: number
  sub?: string
}) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex flex-col gap-2">
      <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg border', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <div>
        <p className="text-2xl font-mono font-bold text-white leading-none">
          <AnimatedNumber value={value} />
        </p>
        <p className="text-xs font-mono text-surface-500 mt-1">{label}</p>
        {sub && <p className="text-[10px] font-mono text-surface-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Outcome chip ─────────────────────────────────────────────────────────────

function OutcomeChip({ outcome }: { outcome: DebateRecord['outcome'] }) {
  if (outcome === 'win') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border bg-emerald/10 text-emerald border-emerald/30">
        <CheckCircle2 className="h-2.5 w-2.5" />
        Win
      </span>
    )
  }
  if (outcome === 'loss') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border bg-against-500/10 text-against-400 border-against-500/30">
        <XCircle className="h-2.5 w-2.5" />
        Loss
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border bg-surface-300/40 text-surface-500 border-surface-400/30">
      <Clock className="h-2.5 w-2.5" />
      Pending
    </span>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
            <Skeleton className="h-8 w-8 rounded-lg mb-2" />
            <Skeleton className="h-6 w-14 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      {/* Win/loss panel */}
      <div className="rounded-xl bg-surface-100 border border-surface-300 p-5">
        <Skeleton className="h-4 w-32 mb-4" />
        <div className="flex items-center gap-6">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      </div>
      {/* List */}
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/2 mb-3" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-10 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Debate row ───────────────────────────────────────────────────────────────

function DebateRow({ record }: { record: DebateRecord }) {
  const catColor = CATEGORY_COLOR[record.topic_category ?? ''] ?? 'text-surface-500'
  const typeClass = DEBATE_TYPE_COLOR[record.debate_type] ?? 'text-surface-500 border-surface-400/30 bg-surface-300/20'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors p-4 group"
    >
      <div className="flex items-start gap-3">
        {/* Side indicator */}
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg border mt-0.5',
            record.side === 'blue'
              ? 'bg-for-500/10 border-for-500/30'
              : 'bg-against-500/10 border-against-500/30'
          )}
          title={record.side === 'blue' ? 'Argued FOR' : 'Argued AGAINST'}
        >
          {record.side === 'blue' ? (
            <ThumbsUp className="h-4 w-4 text-for-400" />
          ) : (
            <ThumbsDown className="h-4 w-4 text-against-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title */}
          <Link
            href={`/debate/${record.debate_id}`}
            className="font-mono text-sm font-semibold text-white hover:text-for-400 transition-colors line-clamp-1 group-hover:text-for-400"
          >
            {truncate(record.title, 70)}
          </Link>

          {/* Topic */}
          <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">
            <span className={catColor}>{record.topic_category ?? 'General'}</span>
            <span className="text-surface-600 mx-1">·</span>
            {truncate(record.topic_statement, 60)}
          </p>

          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
              typeClass
            )}>
              <Swords className="h-2.5 w-2.5" />
              {DEBATE_TYPE_LABEL[record.debate_type] ?? record.debate_type}
            </span>

            {record.is_speaker && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border bg-gold/10 text-gold border-gold/30">
                <Mic className="h-2.5 w-2.5" />
                Speaker
              </span>
            )}

            <OutcomeChip outcome={record.outcome} />

            {record.is_speaker && record.sway_earned > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border bg-emerald/10 text-emerald border-emerald/30">
                <Zap className="h-2.5 w-2.5" />
                +{record.sway_earned} sway
              </span>
            )}
          </div>
        </div>

        {/* Time + link */}
        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          <span className="text-[10px] font-mono text-surface-600">
            {relativeTime(record.ended_at ?? record.scheduled_at)}
          </span>
          <Link
            href={`/debate/${record.debate_id}`}
            className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-500 hover:text-white transition-colors"
            aria-label="Open debate"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MyDebateRecordPage() {
  const router = useRouter()
  const [data, setData] = useState<DebateRecordResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/me/debate-record')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as DebateRecordResponse
      setData(json)
    } catch {
      setError('Could not load your debate record. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const stats: DebateRecordStats | null = data?.stats ?? null
  const debates = data?.debates ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold font-mono text-white">My Debate Record</h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Your full history as a debate participant
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50 flex-shrink-0"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Content ─────────────────────────────────────────────────── */}
        {loading ? (
          <PageSkeleton />
        ) : error ? (
          <div className="rounded-xl bg-surface-100 border border-against-500/30 p-6 text-center">
            <p className="text-sm text-against-400 font-mono mb-3">{error}</p>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 text-white text-sm font-mono hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        ) : !stats || stats.total === 0 ? (
          <div className="space-y-4">
            <EmptyState
              icon={Swords}
              title="No debates yet"
              description="Join a live debate or accept a challenge to start building your record."
              action={{ label: 'Browse Debates', href: '/debate' }}
            />
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/debate"
                className="flex items-center gap-3 p-4 rounded-xl bg-surface-100 border border-surface-300 hover:border-for-500/50 transition-colors group"
              >
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-for-500/10 border border-for-500/30 flex-shrink-0">
                  <Mic className="h-4 w-4 text-for-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white group-hover:text-for-400 transition-colors font-mono">Debates</p>
                  <p className="text-[11px] text-surface-500 font-mono">Find one to join</p>
                </div>
              </Link>
              <Link
                href="/challenges"
                className="flex items-center gap-3 p-4 rounded-xl bg-surface-100 border border-surface-300 hover:border-for-500/50 transition-colors group"
              >
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gold/10 border border-gold/30 flex-shrink-0">
                  <Swords className="h-4 w-4 text-gold" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white group-hover:text-for-400 transition-colors font-mono">Challenges</p>
                  <p className="text-[11px] text-surface-500 font-mono">1-on-1 duels</p>
                </div>
              </Link>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-5"
            >
              {/* ── Stats grid ─────────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                  icon={Swords}
                  iconColor="text-for-400"
                  iconBg="bg-for-500/10 border-for-500/30"
                  label="Total Debates"
                  value={stats.total}
                />
                <StatCard
                  icon={Mic}
                  iconColor="text-gold"
                  iconBg="bg-gold/10 border-gold/30"
                  label="As Speaker"
                  value={stats.as_speaker}
                  sub={`${stats.as_spectator} spectator${stats.as_spectator !== 1 ? 's' : ''}`}
                />
                <StatCard
                  icon={Zap}
                  iconColor="text-emerald"
                  iconBg="bg-emerald/10 border-emerald/30"
                  label="Sway Earned"
                  value={stats.total_sway_earned}
                  sub="minds changed"
                />
                <StatCard
                  icon={BarChart2}
                  iconColor="text-purple"
                  iconBg="bg-purple/10 border-purple/30"
                  label="Resolved"
                  value={stats.completed}
                  sub={`${stats.total - stats.completed} pending`}
                />
              </div>

              {/* ── Win/Loss panel ─────────────────────────────────────── */}
              {stats.completed > 0 && (
                <div className="rounded-xl bg-surface-100 border border-surface-300 p-5">
                  <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-4">
                    Outcome Record
                  </h2>
                  <div className="flex items-center gap-6">
                    {stats.win_rate !== null && (
                      <WinRateRing pct={stats.win_rate} />
                    )}
                    <div className="flex-1 space-y-3">
                      {/* Win bar */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono text-emerald flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Wins
                          </span>
                          <span className="text-xs font-mono font-bold text-white">{stats.wins}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-surface-300 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${stats.completed > 0 ? (stats.wins / stats.completed) * 100 : 0}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            className="h-full bg-emerald rounded-full"
                          />
                        </div>
                      </div>
                      {/* Loss bar */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono text-against-400 flex items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            Losses
                          </span>
                          <span className="text-xs font-mono font-bold text-white">{stats.losses}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-surface-300 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${stats.completed > 0 ? (stats.losses / stats.completed) * 100 : 0}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                            className="h-full bg-against-500 rounded-full"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Side split */}
                  <div className="flex gap-4 mt-4 pt-4 border-t border-surface-300">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-for-500" />
                      <span className="text-xs font-mono text-surface-500">
                        <span className="text-for-400 font-semibold">{stats.as_blue}</span> debates as FOR
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-against-500" />
                      <span className="text-xs font-mono text-surface-500">
                        <span className="text-against-400 font-semibold">{stats.as_red}</span> debates as AGAINST
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Debate list ────────────────────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                    Debate History
                  </h2>
                  <Link
                    href="/debate"
                    className="flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
                  >
                    Find debates <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="space-y-2">
                  {debates.map((record) => (
                    <DebateRow key={record.debate_id} record={record} />
                  ))}
                </div>
              </div>

              {/* ── Footer CTAs ────────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Link
                  href="/leaderboard/debates"
                  className="flex items-center gap-3 p-4 rounded-xl bg-surface-100 border border-surface-300 hover:border-gold/50 transition-colors group"
                >
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gold/10 border border-gold/30 flex-shrink-0">
                    <Trophy className="h-4 w-4 text-gold" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white group-hover:text-gold transition-colors font-mono">Leaderboard</p>
                    <p className="text-[11px] text-surface-500 font-mono">Top debates</p>
                  </div>
                </Link>
                <Link
                  href="/challenges"
                  className="flex items-center gap-3 p-4 rounded-xl bg-surface-100 border border-surface-300 hover:border-for-500/50 transition-colors group"
                >
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-for-500/10 border border-for-500/30 flex-shrink-0">
                    <Swords className="h-4 w-4 text-for-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white group-hover:text-for-400 transition-colors font-mono">Challenges</p>
                    <p className="text-[11px] text-surface-500 font-mono">Issue a duel</p>
                  </div>
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
