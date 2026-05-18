'use client'

/**
 * /flashpoint — Civic Flashpoint
 *
 * A dramatic, live "breaking debate" spotlight: the single most contested
 * topic on the platform right now, scored by vote velocity × contestedness.
 * Updated every 60 seconds via polling.
 *
 * Distinct from:
 *   /trending     — sorted list of many topics
 *   /momentum     — velocity leaderboard
 *   /now          — platform-wide dashboard
 *   /crossfire    — curated FOR vs AGAINST matchups across topics
 *
 * Flashpoint is ONE topic, presented with maximum drama: big vote bar,
 * best argument from each side, live vote counter, share button.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  ChevronRight,
  ExternalLink,
  Flame,
  Gavel,
  RefreshCw,
  Scale,
  Share2,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  FlashpointResponse,
  FlashpointArgument,
} from '@/app/api/topics/flashpoint/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 60_000

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const CATEGORY_COLOR: Record<string, { text: string; bg: string }> = {
  Economics:   { text: 'text-gold',       bg: 'bg-gold/10' },
  Politics:    { text: 'text-for-400',    bg: 'bg-for-500/10' },
  Technology:  { text: 'text-purple',     bg: 'bg-purple/10' },
  Science:     { text: 'text-emerald',    bg: 'bg-emerald/10' },
  Ethics:      { text: 'text-purple',     bg: 'bg-purple/10' },
  Philosophy:  { text: 'text-for-300',    bg: 'bg-for-400/10' },
  Culture:     { text: 'text-against-300', bg: 'bg-against-400/10' },
  Health:      { text: 'text-emerald',    bg: 'bg-emerald/10' },
  Environment: { text: 'text-emerald',    bg: 'bg-emerald/10' },
  Education:   { text: 'text-gold',       bg: 'bg-gold/10' },
}

function catColor(cat: string | null) {
  return cat
    ? (CATEGORY_COLOR[cat] ?? { text: 'text-surface-500', bg: 'bg-surface-300/30' })
    : { text: 'text-surface-500', bg: 'bg-surface-300/30' }
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}

// ─── Argument Card ────────────────────────────────────────────────────────────

function ArgCard({ arg, side }: { arg: FlashpointArgument; side: 'for' | 'against' }) {
  const isFor = side === 'for'
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: isFor ? 0.2 : 0.35 }}
      className={cn(
        'rounded-2xl border p-4 space-y-3 flex-1',
        isFor
          ? 'bg-for-500/5 border-for-500/30'
          : 'bg-against-500/5 border-against-500/30'
      )}
    >
      <div className={cn('flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide', isFor ? 'text-for-400' : 'text-against-400')}>
        {isFor ? <ThumbsUp className="h-3.5 w-3.5" /> : <ThumbsDown className="h-3.5 w-3.5" />}
        {isFor ? 'For' : 'Against'}
        <span className="ml-auto text-surface-500 font-normal normal-case tracking-normal">
          {arg.upvote_count} upvotes
        </span>
      </div>
      <p className="text-sm text-surface-700 leading-relaxed">
        {truncate(arg.content, 240)}
      </p>
      <Link
        href={`/profile/${arg.author_username}`}
        className="flex items-center gap-2 group"
      >
        <Avatar
          src={arg.author_avatar_url}
          fallback={arg.author_display_name ?? arg.author_username}
          size="xs"
        />
        <span className="text-xs text-surface-500 group-hover:text-surface-700 transition-colors">
          {arg.author_display_name ?? arg.author_username}
        </span>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function FlashpointSkeleton() {
  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-4/5" />
        <Skeleton className="h-8 w-3/5" />
        <div className="flex items-center gap-3 pt-2">
          <Skeleton className="h-3 w-full rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-11 rounded-xl" />
          <Skeleton className="h-11 rounded-xl" />
        </div>
      </div>
      {/* Stat row */}
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3 space-y-2">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
      {/* Argument cards */}
      <div className="flex gap-3">
        <div className="flex-1 rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-4/5" />
        </div>
        <div className="flex-1 rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function FlashpointClient() {
  const [data, setData] = useState<FlashpointResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [nextRefresh, setNextRefresh] = useState(POLL_INTERVAL_MS / 1000)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/topics/flashpoint', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed')
      const json: FlashpointResponse = await res.json()
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

    // Poll
    intervalRef.current = setInterval(() => load(true), POLL_INTERVAL_MS)

    // Countdown ticker
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

  async function handleShare() {
    const fp = data?.flashpoint
    if (!fp) return
    const url = `${window.location.origin}/topic/${fp.id}`
    const text = `Current Civic Flashpoint on Lobby Market: "${fp.statement.slice(0, 80)}…" — ${Math.round(fp.blue_pct)}% For / ${100 - Math.round(fp.blue_pct)}% Against`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Civic Flashpoint', text, url })
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // User cancelled share
    }
  }

  const fp = data?.flashpoint
  const forPct = fp ? Math.round(fp.blue_pct) : 50
  const againstPct = 100 - forPct
  const cat = fp?.category ?? null
  const catStyle = catColor(cat)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Page header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-against-500/15 border border-against-500/40 rounded-xl px-3 py-1.5">
              <Flame className="h-4 w-4 text-against-400" />
              <span className="text-sm font-semibold text-against-300">FLASHPOINT</span>
            </div>
            <span className="text-sm text-surface-500">Most contested · right now</span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-700 transition-colors"
            aria-label="Refresh flashpoint"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            {refreshing ? 'Updating…' : `${nextRefresh}s`}
          </button>
        </div>

        {/* ── Content ──────────────────────────────────────────────────── */}
        {loading ? (
          <FlashpointSkeleton />
        ) : !fp ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-12 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-14 w-14 rounded-2xl bg-surface-200 flex items-center justify-center">
                <Scale className="h-7 w-7 text-surface-500" />
              </div>
            </div>
            <div>
              <p className="text-base font-semibold text-surface-700">No flashpoint right now</p>
              <p className="text-sm text-surface-500 mt-1 max-w-xs mx-auto">
                No debates have enough activity to qualify as a flashpoint. Check back soon — the Lobby is always heating up.
              </p>
            </div>
            <button
              onClick={() => load()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-sm text-surface-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        ) : (
          <div className="space-y-4">

            {/* ── Main flashpoint card ─────────────────────────────────── */}
            <motion.div
              key={fp.id}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="rounded-3xl bg-surface-100 border border-against-500/30 p-6 space-y-4 relative overflow-hidden"
            >
              {/* Ambient glow */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-for-500/5 blur-3xl" />
                <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-against-500/5 blur-3xl" />
              </div>

              {/* Status + category row */}
              <div className="flex items-center gap-2 flex-wrap relative">
                <Badge variant={STATUS_BADGE[fp.status] ?? 'proposed'}>
                  {STATUS_LABEL[fp.status] ?? fp.status}
                </Badge>
                {cat && (
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', catStyle.text, catStyle.bg)}>
                    {cat}
                  </span>
                )}
                <span className="ml-auto flex items-center gap-1 text-xs text-against-400 font-medium">
                  <Activity className="h-3.5 w-3.5" />
                  {fp.votes_1h} votes/hr
                </span>
              </div>

              {/* Statement */}
              <div className="relative">
                <h1 className="text-xl sm:text-2xl font-bold text-surface-900 leading-snug">
                  {fp.statement}
                </h1>
              </div>

              {/* Vote bar */}
              <div className="space-y-1.5 relative">
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-for-400">{forPct}% FOR</span>
                  <span className="text-surface-500 text-xs font-normal mt-0.5">
                    {fp.total_votes.toLocaleString()} votes
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
                {/* Contestedness indicator */}
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 flex-1 rounded-full bg-surface-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-against-500 transition-all duration-700"
                      style={{ width: `${fp.contestedness}%` }}
                    />
                  </div>
                  <span className="text-xs text-surface-500">
                    {fp.contestedness}% contested
                  </span>
                </div>
              </div>

              {/* CTA buttons */}
              <div className="grid grid-cols-2 gap-3 relative">
                <Link href={`/topic/${fp.id}`} className="block">
                  <Button variant="for" size="md" className="w-full">
                    <ThumbsUp className="h-4 w-4" />
                    Vote FOR
                  </Button>
                </Link>
                <Link href={`/topic/${fp.id}`} className="block">
                  <Button variant="against" size="md" className="w-full">
                    <ThumbsDown className="h-4 w-4" />
                    Vote AGAINST
                  </Button>
                </Link>
              </div>

              {/* Footer: links + share */}
              <div className="flex items-center justify-between relative pt-1">
                <Link
                  href={`/topic/${fp.id}`}
                  className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-700 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Full debate
                </Link>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-700 transition-colors"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  {copied ? 'Copied!' : 'Share'}
                </button>
              </div>
            </motion.div>

            {/* ── Platform stats strip ─────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: 'Votes this hour',
                  value: data.platform.total_votes_1h.toLocaleString(),
                  icon: <Zap className="h-4 w-4 text-for-400" />,
                },
                {
                  label: 'Active debates',
                  value: data.platform.total_active_topics.toLocaleString(),
                  icon: <Scale className="h-4 w-4 text-purple" />,
                },
                {
                  label: 'Contestedness',
                  value: `${fp.contestedness}%`,
                  icon: <TrendingUp className="h-4 w-4 text-against-400" />,
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center space-y-1"
                >
                  <div className="flex justify-center">{stat.icon}</div>
                  <div className="text-lg font-bold text-surface-900">{stat.value}</div>
                  <div className="text-xs text-surface-500">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* ── Best arguments from each side ─────────────────────────── */}
            {(fp.top_for_arg || fp.top_against_arg) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-surface-700">Top arguments</span>
                  <span className="text-xs text-surface-500">highest upvoted</span>
                  <Link
                    href={`/topic/${fp.id}/arguments`}
                    className="ml-auto text-xs text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
                  >
                    All arguments <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="flex gap-3 flex-col sm:flex-row">
                  {fp.top_for_arg && (
                    <ArgCard arg={fp.top_for_arg} side="for" />
                  )}
                  {fp.top_against_arg && (
                    <ArgCard arg={fp.top_against_arg} side="against" />
                  )}
                  {!fp.top_for_arg && fp.top_against_arg && (
                    <div className="flex-1 rounded-2xl border border-for-500/20 border-dashed p-4 flex items-center justify-center">
                      <Link
                        href={`/topic/${fp.id}/argue`}
                        className="text-sm text-for-400 hover:text-for-300 transition-colors flex items-center gap-1.5"
                      >
                        <ThumbsUp className="h-4 w-4" />
                        Be the first to argue FOR
                      </Link>
                    </div>
                  )}
                  {!fp.top_against_arg && fp.top_for_arg && (
                    <div className="flex-1 rounded-2xl border border-against-500/20 border-dashed p-4 flex items-center justify-center">
                      <Link
                        href={`/topic/${fp.id}/argue`}
                        className="text-sm text-against-400 hover:text-against-300 transition-colors flex items-center gap-1.5"
                      >
                        <ThumbsDown className="h-4 w-4" />
                        Be the first to argue AGAINST
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Recently hot debates ──────────────────────────────────── */}
            {data.recent_flashpoints.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Gavel className="h-4 w-4 text-surface-500" />
                  <span className="text-sm font-semibold text-surface-700">Also heating up</span>
                </div>
                <div className="rounded-2xl bg-surface-100 border border-surface-300 divide-y divide-surface-300">
                  {data.recent_flashpoints.map((t) => {
                    const fp2 = Math.round(t.blue_pct)
                    const cs = catColor(t.category)
                    return (
                      <Link
                        key={t.id}
                        href={`/topic/${t.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-surface-200 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-surface-700 truncate">{t.statement}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {t.category && (
                              <span className={cn('text-xs', cs.text)}>{t.category}</span>
                            )}
                            <span className="text-xs text-surface-500">
                              {fp2}% For · {t.total_votes.toLocaleString()} votes
                            </span>
                          </div>
                        </div>
                        {/* Mini vote bar */}
                        <div className="w-16 flex-shrink-0">
                          <div className="h-1.5 rounded-full bg-surface-200 overflow-hidden">
                            <div
                              className="h-full rounded-l-full bg-for-500"
                              style={{ width: `${fp2}%` }}
                            />
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-surface-400 flex-shrink-0" />
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Explore more ─────────────────────────────────────────── */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
              <p className="text-sm text-surface-500 text-center mb-3">
                Explore the full civic landscape
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { label: 'Trending', href: '/trending', icon: TrendingUp },
                  { label: 'Momentum', href: '/momentum', icon: Zap },
                  { label: 'Crossfire', href: '/crossfire', icon: Flame },
                  { label: 'All Debates', href: '/', icon: Scale },
                  { label: 'Discover', href: '/discover', icon: Activity },
                  { label: 'The Laws', href: '/law', icon: Gavel },
                ].map(({ label, href, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 transition-colors"
                  >
                    <Icon className="h-4 w-4 text-surface-500 flex-shrink-0" />
                    <span className="text-sm text-surface-600">{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
