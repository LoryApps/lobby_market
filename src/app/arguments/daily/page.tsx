'use client'

/**
 * /arguments/daily — Argument of the Day
 *
 * Every calendar day, a single argument from the community is spotlighted.
 * Chosen deterministically so every visitor sees the same argument on the
 * same day. Must have ≥ 3 upvotes and be at least 24 hours old.
 *
 * Shows: the full argument, its author, the parent topic context,
 * the top counter-argument, an impact note, and yesterday's pick.
 * Refreshes at midnight UTC.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Flame,
  Gavel,
  MessageSquare,
  Quote,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  User,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { DailyArgumentResponse, DailyArgument } from '@/app/api/arguments/daily/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 30) return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  return `${m}m ago`
}

function formatCountdown(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1_000)
  return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`
}

const ROLE_LABELS: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
}

const ROLE_COLORS: Record<string, string> = {
  person: 'text-surface-500',
  debator: 'text-for-400',
  troll_catcher: 'text-emerald',
  elder: 'text-gold',
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: '#f59e0b',
  Politics: '#60a5fa',
  Technology: '#8b5cf6',
  Science: '#10b981',
  Ethics: '#f87171',
  Philosophy: '#818cf8',
  Culture: '#fb923c',
  Health: '#f472b6',
  Environment: '#4ade80',
  Education: '#22d3ee',
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full ml-auto" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-5 w-3/5" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </div>
      <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-5/6" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  )
}

// ─── Vote bar ─────────────────────────────────────────────────────────────────

function VoteBar({ bluePct }: { bluePct: number }) {
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300">
      <motion.div
        className="bg-for-500 h-full"
        initial={{ width: 0 }}
        animate={{ width: `${bluePct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      <div className="flex-1 bg-against-500/70" />
    </div>
  )
}

// ─── Argument card (main hero) ─────────────────────────────────────────────────

function HeroArgumentCard({ arg, isYesterday }: { arg: DailyArgument; isYesterday?: boolean }) {
  const isFor = arg.side === 'blue'
  const sideColor = isFor ? 'text-for-400' : 'text-against-400'
  const sideBg = isFor ? 'bg-for-500/10 border-for-500/30' : 'bg-against-500/10 border-against-500/30'
  const sideLabel = isFor ? 'FOR' : 'AGAINST'
  const SideIcon = isFor ? ThumbsUp : ThumbsDown

  return (
    <div className={cn(
      'rounded-2xl border bg-surface-100 p-6 space-y-5',
      isYesterday ? 'border-surface-300 opacity-80' : 'border-surface-300'
    )}>
      {/* Author row */}
      <div className="flex items-start gap-3">
        {arg.author ? (
          <Link href={`/profile/${arg.author.username}`} className="flex-shrink-0">
            <Avatar
              src={arg.author.avatar_url}
              username={arg.author.username}
              size="md"
              className="ring-2 ring-surface-300"
            />
          </Link>
        ) : (
          <div className="h-10 w-10 rounded-full bg-surface-200 flex items-center justify-center flex-shrink-0">
            <User className="h-5 w-5 text-surface-500" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {arg.author ? (
            <>
              <Link href={`/profile/${arg.author.username}`} className="hover:underline">
                <span className="font-mono font-semibold text-sm text-white">
                  {arg.author.display_name ?? arg.author.username}
                </span>
              </Link>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn('text-[11px] font-mono font-semibold', ROLE_COLORS[arg.author.role] ?? 'text-surface-500')}>
                  {ROLE_LABELS[arg.author.role] ?? arg.author.role}
                </span>
                {arg.author.clout > 0 && (
                  <>
                    <span className="text-surface-500">·</span>
                    <span className="flex items-center gap-0.5 text-[11px] font-mono text-gold">
                      <Zap className="h-2.5 w-2.5" />
                      {arg.author.clout.toLocaleString()}
                    </span>
                  </>
                )}
              </div>
            </>
          ) : (
            <span className="font-mono font-semibold text-sm text-surface-500">Anonymous</span>
          )}
          <p className="text-[11px] font-mono text-surface-500 mt-0.5">{relativeTime(arg.created_at)}</p>
        </div>

        {/* Side pill */}
        <div className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono font-bold flex-shrink-0',
          sideBg, sideColor
        )}>
          <SideIcon className="h-3 w-3" />
          {sideLabel}
        </div>
      </div>

      {/* Quote */}
      <div className="relative">
        <Quote className="absolute -top-1 -left-1 h-5 w-5 text-surface-400 opacity-40" />
        <p className="text-base text-white leading-relaxed font-[450] pl-4">
          {arg.content}
        </p>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-gold">
          <ThumbsUp className="h-4 w-4" />
          <span className="font-mono font-bold text-sm">{arg.upvotes.toLocaleString()}</span>
          <span className="text-[11px] font-mono text-surface-500">upvotes</span>
        </div>
        {arg.topic && (
          <>
            <span className="text-surface-500 text-xs">·</span>
            <Link
              href={`/topic/${arg.topic.id}`}
              className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              View topic
            </Link>
          </>
        )}
      </div>

      {/* Impact note */}
      {arg.impact_note && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-surface-200/50 border border-surface-300">
          <Flame className="h-3.5 w-3.5 text-gold flex-shrink-0 mt-0.5" />
          <p className="text-[11px] font-mono text-surface-500 leading-relaxed">{arg.impact_note}</p>
        </div>
      )}
    </div>
  )
}

// ─── Topic card ────────────────────────────────────────────────────────────────

function TopicCard({ arg }: { arg: DailyArgument }) {
  if (!arg.topic) return null
  const t = arg.topic
  const catColor = CATEGORY_COLORS[t.category ?? ''] ?? '#71717a'

  return (
    <Link href={`/topic/${t.id}`} className="block group">
      <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 hover:border-surface-400 transition-colors">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              {t.category && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider"
                  style={{ color: catColor, backgroundColor: `${catColor}15`, border: `1px solid ${catColor}30` }}
                >
                  {t.category}
                </span>
              )}
              <Badge variant={t.status as 'proposed' | 'active' | 'law' | 'failed'} size="sm">
                {t.status.toUpperCase()}
              </Badge>
            </div>
            <p className="font-mono text-sm font-semibold text-white leading-snug group-hover:text-for-300 transition-colors">
              {t.statement}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
        </div>

        <VoteBar bluePct={t.blue_pct} />

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1 text-for-400">
            <ThumbsUp className="h-3 w-3" />
            <span className="text-[10px] font-mono font-bold">{t.blue_pct}% FOR</span>
          </div>
          <span className="text-[10px] font-mono text-surface-500">
            {t.total_votes.toLocaleString()} votes
          </span>
          <div className="flex items-center gap-1 text-against-400">
            <span className="text-[10px] font-mono font-bold">{100 - t.blue_pct}% AGN</span>
            <ThumbsDown className="h-3 w-3" />
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Counter argument card ─────────────────────────────────────────────────────

function CounterArgumentCard({ arg }: { arg: DailyArgument }) {
  if (!arg.counterpart) return null
  const cp = arg.counterpart
  const isFor = cp.side === 'blue'
  const sideColor = isFor ? 'text-for-400' : 'text-against-400'
  const sideBg = isFor ? 'bg-for-500/5 border-for-500/20' : 'bg-against-500/5 border-against-500/20'
  const sideLabel = isFor ? 'FOR' : 'AGAINST'

  return (
    <div className={cn('rounded-2xl border bg-surface-100 p-5', sideBg)}>
      <div className="flex items-center gap-2 mb-3">
        <Scale className={cn('h-4 w-4', sideColor)} />
        <span className="text-xs font-mono font-bold text-surface-500 uppercase tracking-wider">
          Top Counter-Argument
        </span>
        <span className={cn('text-[10px] font-mono font-bold px-1.5 py-0.5 rounded', sideColor)}>
          {sideLabel}
        </span>
      </div>

      {cp.author && (
        <div className="flex items-center gap-2 mb-2">
          <Avatar
            src={cp.author.avatar_url}
            username={cp.author.username}
            size="xs"
          />
          <span className="text-[11px] font-mono text-surface-500">
            {cp.author.display_name ?? cp.author.username}
          </span>
          <span className="text-[10px] font-mono text-surface-500 ml-auto flex items-center gap-1">
            <ThumbsUp className="h-3 w-3 text-gold" />
            {cp.upvotes}
          </span>
        </div>
      )}

      <p className="text-sm text-surface-600 leading-relaxed line-clamp-4">{cp.content}</p>

      {arg.topic && (
        <Link
          href={`/topic/${arg.topic.id}`}
          className="inline-flex items-center gap-1 mt-3 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
        >
          <MessageSquare className="h-3 w-3" />
          See full debate
        </Link>
      )}
    </div>
  )
}

// ─── Yesterday card ────────────────────────────────────────────────────────────

function YesterdayCard({ arg }: { arg: DailyArgument }) {
  const isFor = arg.side === 'blue'
  const sideColor = isFor ? 'text-for-400' : 'text-against-400'

  return (
    <div className="rounded-2xl border border-surface-300/60 bg-surface-100/60 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="h-4 w-4 text-surface-500" />
        <span className="text-xs font-mono font-bold text-surface-500 uppercase tracking-wider">
          Yesterday&apos;s Pick
        </span>
      </div>

      {arg.author && (
        <div className="flex items-center gap-2 mb-2">
          <Avatar
            src={arg.author.avatar_url}
            username={arg.author.username}
            size="xs"
          />
          <span className="text-[11px] font-mono text-surface-500">
            {arg.author.display_name ?? arg.author.username}
          </span>
          <span className={cn('text-[10px] font-mono font-bold ml-auto', sideColor)}>
            {isFor ? 'FOR' : 'AGAINST'}
          </span>
        </div>
      )}

      <p className="text-sm text-surface-600 leading-relaxed line-clamp-3">{arg.content}</p>

      {arg.topic && (
        <Link
          href={`/topic/${arg.topic.id}`}
          className="inline-flex items-center gap-1 mt-3 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          {arg.topic.statement.length > 60 ? arg.topic.statement.slice(0, 60) + '…' : arg.topic.statement}
        </Link>
      )}
    </div>
  )
}

// ─── Countdown ────────────────────────────────────────────────────────────────

function Countdown({ ms }: { ms: number }) {
  const [remaining, setRemaining] = useState(ms)

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500">
      <Clock className="h-3 w-3" />
      <span>Next argument in <span className="text-white font-bold">{formatCountdown(remaining)}</span></span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ArgumentOfTheDayPage() {
  const [data, setData] = useState<DailyArgumentResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/arguments/daily', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      setData(json as DailyArgumentResponse)
    } catch {
      setError('Could not load today\'s argument.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-28 md:pb-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Link
                href="/arguments"
                className={cn(
                  'flex items-center justify-center h-9 w-9 rounded-lg',
                  'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors'
                )}
                aria-label="Back to Arguments"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30">
                <Trophy className="h-5 w-5 text-gold" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">Argument of the Day</h1>
                <p className="text-xs font-mono text-surface-500 mt-0.5">{today}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Share button */}
              <button
                onClick={handleCopy}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-mono font-semibold',
                  'border transition-all',
                  copied
                    ? 'bg-emerald/10 border-emerald/30 text-emerald'
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                )}
                aria-label="Copy link"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
              </button>

              <button
                onClick={load}
                className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
                aria-label="Refresh"
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </button>
            </div>
          </div>

          {/* Subheadline */}
          <p className="text-sm text-surface-500 font-mono">
            One argument. Chosen from{' '}
            {data ? (
              <span className="text-white font-bold">{data.total_eligible.toLocaleString()}</span>
            ) : (
              <span className="text-surface-400">…</span>
            )}{' '}
            eligible arguments. Refreshes at midnight UTC.
          </p>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PageSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-against-500/30 bg-surface-100 p-8 text-center"
            >
              <Award className="h-10 w-10 text-surface-500 mx-auto mb-3" />
              <p className="font-mono text-against-400 mb-4">{error}</p>
              <button
                onClick={load}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-white font-mono text-sm hover:bg-surface-300 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </motion.div>
          ) : data ? (
            <motion.div
              key="data"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-5"
            >
              {/* Daily position badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold/10 border border-gold/30 text-[11px] font-mono font-bold text-gold uppercase tracking-wider">
                    <Trophy className="h-3 w-3" />
                    Argument #{data.arg_index + 1} of {data.total_eligible}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-200 border border-surface-300 text-[11px] font-mono text-surface-500">
                    Day {data.day_index}
                  </span>
                </div>
                <Countdown ms={data.next_refresh_ms} />
              </div>

              {/* Hero argument */}
              <HeroArgumentCard arg={data.today} />

              {/* Parent topic */}
              {data.today.topic && (
                <div>
                  <h2 className="text-xs font-mono font-bold text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Gavel className="h-3.5 w-3.5" />
                    The Debate
                  </h2>
                  <TopicCard arg={data.today} />
                </div>
              )}

              {/* Counter-argument */}
              {data.today.counterpart && (
                <CounterArgumentCard arg={data.today} />
              )}

              {/* Browse more */}
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/arguments"
                  className={cn(
                    'flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
                    'border border-surface-300 bg-surface-100 text-surface-500',
                    'hover:bg-surface-200 hover:text-white font-mono text-sm font-semibold transition-colors'
                  )}
                >
                  <MessageSquare className="h-4 w-4" />
                  All Arguments
                </Link>
                <Link
                  href="/arguments/trending"
                  className={cn(
                    'flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
                    'border border-gold/30 bg-gold/10 text-gold',
                    'hover:bg-gold/20 font-mono text-sm font-semibold transition-colors'
                  )}
                >
                  <Flame className="h-4 w-4" />
                  Trending Now
                </Link>
              </div>

              {/* Yesterday's pick */}
              {data.yesterday && (
                <div>
                  <h2 className="text-xs font-mono font-bold text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Yesterday&apos;s Featured Argument
                  </h2>
                  <YesterdayCard arg={data.yesterday} />
                </div>
              )}

              {/* Nomination CTA */}
              <div className="rounded-2xl border border-for-500/20 bg-for-500/5 p-5 flex items-start gap-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/20 flex-shrink-0">
                  <Quote className="h-5 w-5 text-for-400" />
                </div>
                <div>
                  <h3 className="font-mono text-sm font-bold text-white mb-1">
                    Want your argument featured?
                  </h3>
                  <p className="text-xs text-surface-500 leading-relaxed mb-3">
                    Arguments with 3+ upvotes are eligible. Write clear, evidence-backed reasoning
                    to earn community recognition.
                  </p>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-for-400 hover:text-for-300 transition-colors"
                  >
                    Browse active debates
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
