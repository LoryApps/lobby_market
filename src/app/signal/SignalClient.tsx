'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Clock,
  ExternalLink,
  Gavel,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  TrendingDown,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { SignalArgument, SignalResponse, SignalTopic, SignalRunner } from '@/app/api/signal/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 45_000

// ─── Category colors ──────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, { text: string; bg: string }> = {
  Economics:   { text: 'text-gold',         bg: 'bg-gold/10' },
  Politics:    { text: 'text-for-400',       bg: 'bg-for-500/10' },
  Technology:  { text: 'text-purple',        bg: 'bg-purple/10' },
  Science:     { text: 'text-emerald',       bg: 'bg-emerald/10' },
  Ethics:      { text: 'text-purple',        bg: 'bg-purple/10' },
  Philosophy:  { text: 'text-for-300',       bg: 'bg-for-400/10' },
  Culture:     { text: 'text-against-300',   bg: 'bg-against-400/10' },
  Health:      { text: 'text-emerald',       bg: 'bg-emerald/10' },
  Environment: { text: 'text-emerald',       bg: 'bg-emerald/10' },
  Education:   { text: 'text-purple',        bg: 'bg-purple/10' },
}

function catColor(cat: string | null) {
  return CATEGORY_COLOR[cat ?? ''] ?? { text: 'text-surface-500', bg: 'bg-surface-200' }
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

// ─── Signal strength visual ───────────────────────────────────────────────────

function SignalStrengthBars({ score }: { score: number }) {
  const bars = 5
  const active = Math.round((score / 100) * bars)
  return (
    <div className="flex items-end gap-0.5" aria-label={`Signal strength: ${score}/100`}>
      {Array.from({ length: bars }, (_, i) => (
        <div
          key={i}
          className={cn(
            'rounded-sm transition-colors',
            i < active
              ? i >= bars - 1 ? 'bg-against-500' : i >= bars - 2 ? 'bg-gold' : 'bg-for-500'
              : 'bg-surface-300',
          )}
          style={{ width: 4, height: 6 + i * 3 }}
        />
      ))}
    </div>
  )
}

// ─── Countdown ────────────────────────────────────────────────────────────────

function VotingCountdown({ votingEndsAt }: { votingEndsAt: string | null }) {
  const [display, setDisplay] = useState<string>('')

  useEffect(() => {
    if (!votingEndsAt) return
    function tick() {
      const ms = new Date(votingEndsAt!).getTime() - Date.now()
      if (ms <= 0) { setDisplay('Voting closed'); return }
      const h = Math.floor(ms / 3_600_000)
      const m = Math.floor((ms % 3_600_000) / 60_000)
      const s = Math.floor((ms % 60_000) / 1_000)
      if (h > 0) setDisplay(`${h}h ${m}m remaining`)
      else if (m > 0) setDisplay(`${m}m ${s}s remaining`)
      else setDisplay(`${s}s remaining`)
    }
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [votingEndsAt])

  if (!votingEndsAt || !display) return null
  return (
    <div className="flex items-center gap-1.5 text-xs text-gold font-mono font-medium">
      <Clock className="h-3 w-3" />
      {display}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SignalSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-24 rounded-xl" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="h-4 w-48" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Runner card ──────────────────────────────────────────────────────────────

function RunnerCard({ runner }: { runner: SignalRunner }) {
  const forPct = Math.round(runner.blue_pct)
  const distToLaw = Math.abs(forPct - 75)
  const distToFail = Math.abs(forPct - 25)
  const nearLaw = distToLaw <= distToFail

  return (
    <Link
      href={`/topic/${runner.id}`}
      className="group flex items-start gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-surface-700 truncate leading-snug group-hover:text-white transition-colors">
          {runner.statement}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] font-mono text-for-400">{forPct}% FOR</span>
          <div className="flex-1 h-1 bg-surface-300 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(to right, #3b82f6 ${forPct}%, #ef4444 ${forPct}%)`,
                width: '100%',
              }}
            />
          </div>
          <span className="text-[10px] font-mono text-against-400">{100 - forPct}%</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className={cn('text-[10px] font-mono', nearLaw ? 'text-gold' : 'text-against-400')}>
            {nearLaw ? '↑' : '↓'} {Math.min(distToLaw, distToFail).toFixed(1)}% from {nearLaw ? 'law' : 'fail'}
          </span>
          {runner.hours_remaining !== null && runner.hours_remaining < 24 && (
            <span className="text-[10px] font-mono text-gold ml-auto">
              {Math.round(runner.hours_remaining)}h left
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0 group-hover:text-surface-700 transition-colors mt-0.5" />
    </Link>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgCard({
  arg,
  side,
}: {
  arg: SignalArgument
  side: 'for' | 'against'
}) {
  const isFor = side === 'for'
  return (
    <div
      className={cn(
        'rounded-2xl border p-4 space-y-2.5',
        isFor
          ? 'bg-for-500/5 border-for-500/20'
          : 'bg-against-500/5 border-against-500/20',
      )}
    >
      <div className="flex items-center gap-1.5">
        {isFor ? (
          <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
        ) : (
          <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
        )}
        <span
          className={cn(
            'text-[11px] font-semibold uppercase tracking-wide',
            isFor ? 'text-for-400' : 'text-against-400',
          )}
        >
          {isFor ? 'For' : 'Against'}
        </span>
        <span className="ml-auto text-[10px] text-surface-500 font-mono">
          {arg.upvote_count} upvotes
        </span>
      </div>
      <p className="text-xs text-surface-700 leading-relaxed line-clamp-3">{arg.content}</p>
      <div className="flex items-center gap-1.5">
        <Avatar
          src={arg.author_avatar_url}
          fallback={arg.author_display_name ?? arg.author_username}
          size="xs"
        />
        <span className="text-[10px] text-surface-500 truncate">
          {arg.author_display_name ?? arg.author_username}
        </span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SignalClient() {
  const [data, setData] = useState<SignalResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [nextRefresh, setNextRefresh] = useState(POLL_INTERVAL_MS / 1000)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/signal', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed')
      const json: SignalResponse = await res.json()
      if (mountedRef.current) {
        setData(json)
        setNextRefresh(POLL_INTERVAL_MS / 1000)
      }
    } catch {
      // Keep stale data on error
    } finally {
      if (mountedRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    load()
    intervalRef.current = setInterval(() => load(true), POLL_INTERVAL_MS)
    countdownRef.current = setInterval(() => {
      setNextRefresh((n) => (n <= 1 ? POLL_INTERVAL_MS / 1000 : n - 1))
    }, 1000)
    return () => {
      mountedRef.current = false
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [load])

  function handleRefresh() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    load(true).then(() => {
      intervalRef.current = setInterval(() => load(true), POLL_INTERVAL_MS)
      countdownRef.current = setInterval(() => {
        setNextRefresh((n) => (n <= 1 ? POLL_INTERVAL_MS / 1000 : n - 1))
      }, 1000)
    })
  }

  const sig = data?.signal ?? null
  const forPct = sig ? Math.round(sig.blue_pct) : 50
  const againstPct = 100 - forPct
  const cat = sig?.category ?? null
  const catStyle = catColor(cat)

  // Threshold proximity bar: where is current vote relative to nearest threshold?
  const isNearLaw = sig?.nearest_threshold === 'law'
  const thresholdPct = isNearLaw ? 75 : 25

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Page header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-gold/10 border border-gold/40 rounded-xl px-3 py-1.5">
              <Activity className="h-4 w-4 text-gold" />
              <span className="text-sm font-semibold text-gold">SIGNAL</span>
            </div>
            <span className="text-sm text-surface-500">Most urgent vote right now</span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-700 transition-colors"
            aria-label="Refresh signal"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            {refreshing ? 'Updating…' : `${nextRefresh}s`}
          </button>
        </div>

        {/* ── Content ──────────────────────────────────────────────────── */}
        {loading ? (
          <SignalSkeleton />
        ) : !sig ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-12 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-14 w-14 rounded-2xl bg-surface-200 flex items-center justify-center">
                <Scale className="h-7 w-7 text-surface-500" />
              </div>
            </div>
            <div>
              <p className="text-base font-semibold text-surface-700">No critical signal right now</p>
              <p className="text-sm text-surface-500 mt-1 max-w-xs mx-auto">
                No debate is currently close enough to a decisive threshold to trigger an alert. The Lobby is steady — check back soon.
              </p>
            </div>
            <button
              onClick={() => load()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-sm text-surface-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        ) : (
          <div className="space-y-4">

            {/* ── Main signal card ─────────────────────────────────────── */}
            <AnimatePresence mode="wait">
              <motion.div
                key={sig.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
                className="rounded-3xl bg-surface-100 border border-gold/25 p-6 space-y-5 relative overflow-hidden"
              >
                {/* Ambient glow */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-gold/4 blur-3xl" />
                  <div
                    className={cn(
                      'absolute -bottom-16 -left-16 w-48 h-48 rounded-full blur-3xl',
                      isNearLaw ? 'bg-for-500/5' : 'bg-against-500/5',
                    )}
                  />
                </div>

                {/* Header row: status + signal strength + category */}
                <div className="flex items-center gap-2 flex-wrap relative">
                  <Badge variant={STATUS_BADGE[sig.status] ?? 'proposed'}>
                    {STATUS_LABEL[sig.status] ?? sig.status}
                  </Badge>
                  {cat && (
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', catStyle.text, catStyle.bg)}>
                      {cat}
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-surface-500">signal</span>
                    <SignalStrengthBars score={sig.signal_score} />
                    <span className="text-[10px] font-mono text-gold">{sig.signal_score}</span>
                  </div>
                </div>

                {/* Countdown + reason banner */}
                <div className="relative space-y-1">
                  {sig.voting_ends_at && (
                    <VotingCountdown votingEndsAt={sig.voting_ends_at} />
                  )}
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-gold mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-gold font-mono leading-snug">{sig.signal_reason}</p>
                  </div>
                </div>

                {/* Statement */}
                <div className="relative">
                  <h1 className="text-xl sm:text-2xl font-bold text-surface-900 leading-snug">
                    {sig.statement}
                  </h1>
                </div>

                {/* Vote split */}
                <div className="space-y-2 relative">
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-for-400">{forPct}% FOR</span>
                    <span className="text-surface-500 text-xs font-normal mt-0.5">
                      {sig.total_votes.toLocaleString()} votes
                    </span>
                    <span className="text-against-400">{againstPct}% AGAINST</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-surface-200 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(to right, #3b82f6 ${forPct}%, #ef4444 ${forPct}%)`,
                      }}
                      initial={{ width: '50%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>

                  {/* Threshold proximity indicator */}
                  <div className="relative">
                    <div className="h-1 bg-surface-200 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-700',
                          isNearLaw ? 'bg-for-500' : 'bg-against-500',
                        )}
                        style={{
                          width: `${Math.max(5, 100 - sig.threshold_gap * 5)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[10px] text-surface-500 font-mono">
                        {isNearLaw ? 'Proximity to consensus (75%)' : 'Proximity to defeat (25%)'}
                      </span>
                      <span
                        className={cn(
                          'text-[10px] font-semibold font-mono',
                          isNearLaw ? 'text-for-400' : 'text-against-400',
                        )}
                      >
                        {sig.threshold_gap.toFixed(1)}% away
                      </span>
                    </div>
                  </div>

                  {/* Threshold line annotation */}
                  <div className="flex items-center gap-1.5 text-[10px] text-surface-500">
                    {isNearLaw ? (
                      <>
                        <TrendingUp className="h-3 w-3 text-for-400" />
                        <span>
                          FOR needs to reach <span className="text-for-400 font-semibold">75%</span> to
                          achieve consensus
                        </span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-3 w-3 text-against-400" />
                        <span>
                          FOR must stay above <span className="text-against-400 font-semibold">25%</span> to
                          avoid decisive defeat
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Arguments */}
                {(sig.top_for_arg || sig.top_against_arg) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
                    {sig.top_for_arg && <ArgCard arg={sig.top_for_arg} side="for" />}
                    {sig.top_against_arg && <ArgCard arg={sig.top_against_arg} side="against" />}
                  </div>
                )}

                {/* CTA row */}
                <div className="flex items-center gap-3 relative">
                  <Link
                    href={`/topic/${sig.id}`}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-semibold transition-colors"
                  >
                    <Gavel className="h-4 w-4" />
                    Vote on this topic
                  </Link>
                  <Link
                    href={`/topic/${sig.id}/argue`}
                    className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 text-sm font-semibold text-surface-700 transition-colors"
                  >
                    <Zap className="h-4 w-4" />
                    Argue
                  </Link>
                  <Link
                    href={`/topic/${sig.id}`}
                    className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 text-surface-500 transition-colors"
                    aria-label="View full topic"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* ── How the signal is computed ─────────────────────────── */}
            <div className="rounded-2xl bg-surface-100/50 border border-surface-300/60 p-4 space-y-2">
              <p className="text-xs font-semibold text-surface-600 uppercase tracking-wide">How this is chosen</p>
              <p className="text-xs text-surface-500 leading-relaxed">
                The Civic Signal ranks every debate by urgency: threshold proximity (how close to 75% law or 25% defeat),
                time pressure (voting deadline), and total engagement. The topic with the highest combined score
                becomes the signal. Updates every 45 seconds.
              </p>
            </div>

            {/* ── Runner-ups ─────────────────────────────────────────── */}
            {(data?.runners?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
                    Also on signal
                  </p>
                  <Link
                    href="/topics"
                    className="flex items-center gap-1 text-xs text-for-400 hover:text-for-300 transition-colors"
                  >
                    All topics
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="space-y-2">
                  {(data?.runners ?? []).map((runner) => (
                    <RunnerCard key={runner.id} runner={runner} />
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
