'use client'

/**
 * /relays/weekly — Relay of the Week
 *
 * Showcases the single best completed relay chain from the current week,
 * ranked by community compelling votes + leg star quality (same formula
 * as the Relay League). Each week a new champion is crowned.
 *
 * Distinct from:
 *   /relays/league     — full ranked list of all week's relays
 *   /relays/champions  — top relay BUILDERS (user-focused)
 *   /relays/[id]       — individual relay detail + join CTA
 *   /relays/showdown   — FOR vs AGAINST head-to-head
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Crown,
  ExternalLink,
  GitMerge,
  Link2,
  Loader2,
  RefreshCw,
  Share2,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { WeeklyRelay, WeeklyResponse, WeeklyLeg } from '@/app/api/relays/weekly/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatWeekLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Category colour ──────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-purple',
  Culture: 'text-emerald',
  Health: 'text-for-400',
  Environment: 'text-emerald',
  Education: 'text-gold',
}

function catColor(cat: string | null) {
  return cat ? (CAT_COLOR[cat] ?? 'text-surface-400') : 'text-surface-400'
}

// ─── Side config ──────────────────────────────────────────────────────────────

const SIDE_CONFIG = {
  for: {
    label: 'FOR',
    accent: 'text-for-400',
    border: 'border-for-700/50',
    bg: 'bg-for-900/15',
    connectorBg: 'bg-for-800/40',
    badgeCls: 'text-for-400 bg-for-500/10',
    glow: 'shadow-for-500/10',
  },
  against: {
    label: 'AGAINST',
    accent: 'text-against-400',
    border: 'border-against-700/50',
    bg: 'bg-against-900/15',
    connectorBg: 'bg-against-800/40',
    badgeCls: 'text-against-400 bg-against-500/10',
    glow: 'shadow-against-500/10',
  },
} as const

// ─── Leg card ─────────────────────────────────────────────────────────────────

function LegCard({
  leg,
  isFor,
  isLast,
}: {
  leg: WeeklyLeg
  isFor: boolean
  isLast: boolean
}) {
  const cfg = isFor ? SIDE_CONFIG.for : SIDE_CONFIG.against

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: leg.leg_number * 0.06 }}
      className="flex gap-3"
    >
      {/* Spine */}
      <div className="flex flex-col items-center flex-shrink-0">
        <Link href={`/profile/${leg.author_username}`} className="flex-shrink-0 z-10">
          <Avatar
            src={leg.author_avatar_url}
            fallback={leg.author_display_name || leg.author_username}
            size="sm"
          />
        </Link>
        {!isLast && (
          <div
            className={cn('w-0.5 flex-1 mt-2', cfg.connectorBg)}
            style={{ minHeight: '40px' }}
          />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex-1', isLast ? 'pb-0' : 'pb-5')}>
        {/* Author + meta */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Link
            href={`/profile/${leg.author_username}`}
            className="text-[13px] font-mono font-semibold text-white hover:text-for-300 transition-colors"
          >
            {leg.author_display_name || leg.author_username}
          </Link>
          <span className={cn(
            'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black font-mono uppercase tracking-wider',
            cfg.badgeCls
          )}>
            Leg {leg.leg_number}
          </span>
          <span className="text-[11px] font-mono text-surface-600">
            {relativeTime(leg.created_at)}
          </span>
          {leg.upvote_count > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-mono text-gold">
              <Star className="h-3 w-3 fill-gold" />
              {leg.upvote_count}
            </span>
          )}
        </div>

        {/* Argument text */}
        <div className={cn('rounded-xl border p-4', cfg.bg, cfg.border)}>
          <p className="text-sm font-mono text-surface-100 leading-relaxed">{leg.content}</p>
        </div>

        {!isLast && (
          <p className={cn('text-[10px] font-mono mt-2.5 ml-1', isFor ? 'text-for-800' : 'text-against-800')}>
            builds on →
          </p>
        )}
      </div>
    </motion.div>
  )
}

// ─── Contributor gallery ──────────────────────────────────────────────────────

function ContributorGallery({ relay }: { relay: WeeklyRelay }) {
  const contributors = relay.legs.map((leg) => ({
    username: leg.author_username,
    displayName: leg.author_display_name,
    avatarUrl: leg.author_avatar_url,
    legNumber: leg.leg_number,
    upvotes: leg.upvote_count,
  }))

  return (
    <div className="rounded-2xl border border-surface-300/40 bg-surface-200/30 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-4 w-4 text-surface-400" />
        <span className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
          Chain Contributors
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {/* Starter */}
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gold/5 border border-gold/20">
          <Link href={`/profile/${relay.starter_username}`}>
            <Avatar
              src={relay.starter_avatar_url}
              fallback={relay.starter_display_name || relay.starter_username}
              size="sm"
            />
          </Link>
          <div className="flex-1 min-w-0">
            <Link
              href={`/profile/${relay.starter_username}`}
              className="text-[13px] font-mono font-semibold text-white hover:text-gold transition-colors truncate block"
            >
              {relay.starter_display_name || relay.starter_username}
            </Link>
            <span className="text-[10px] font-mono text-gold">Chain Starter</span>
          </div>
          <Crown className="h-4 w-4 text-gold flex-shrink-0" />
        </div>
        {/* Leg contributors */}
        {contributors.map((c) => (
          <div key={c.legNumber} className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-200/40">
            <Link href={`/profile/${c.username}`}>
              <Avatar
                src={c.avatarUrl}
                fallback={c.displayName || c.username}
                size="sm"
              />
            </Link>
            <div className="flex-1 min-w-0">
              <Link
                href={`/profile/${c.username}`}
                className="text-[13px] font-mono font-semibold text-white hover:text-for-300 transition-colors truncate block"
              >
                {c.displayName || c.username}
              </Link>
              <span className="text-[10px] font-mono text-surface-500">Leg {c.legNumber}</span>
            </div>
            {c.upvotes > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-mono text-gold flex-shrink-0">
                <Star className="h-3 w-3 fill-gold" />
                {c.upvotes}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Vote section ─────────────────────────────────────────────────────────────

function VoteSection({ relay, onVote }: { relay: WeeklyRelay; onVote: (v: 'compelling' | 'not_compelling') => void }) {
  const [busy, setBusy] = useState(false)

  async function handleVote(vote: 'compelling' | 'not_compelling') {
    if (busy || relay.user_vote) return
    setBusy(true)
    try {
      const res = await fetch(`/api/relays/${relay.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'vote', vote }),
      })
      if (res.ok) onVote(vote)
    } catch {
      // best-effort
    } finally {
      setBusy(false)
    }
  }

  const totalVotes = relay.vote_compelling + relay.vote_not_compelling
  const compPct = relay.compelling_pct

  return (
    <div className="rounded-2xl border border-surface-300/40 bg-surface-200/30 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="h-4 w-4 text-surface-400" />
        <span className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
          Community Verdict
        </span>
      </div>

      {/* Vote bar */}
      {totalVotes > 0 && compPct !== null && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-mono text-for-400">Compelling {compPct}%</span>
            <span className="text-[11px] font-mono text-surface-500">{totalVotes} votes</span>
          </div>
          <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full bg-for-500 rounded-full transition-all duration-500"
              style={{ width: `${compPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] font-mono text-for-600">{relay.vote_compelling} compelling</span>
            <span className="text-[10px] font-mono text-against-600">{relay.vote_not_compelling} not compelling</span>
          </div>
        </div>
      )}

      {/* Vote buttons */}
      {relay.user_vote ? (
        <div className={cn(
          'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-mono font-semibold',
          relay.user_vote === 'compelling'
            ? 'bg-for-500/10 border border-for-500/30 text-for-400'
            : 'bg-against-500/10 border border-against-500/30 text-against-400'
        )}>
          {relay.user_vote === 'compelling' ? (
            <ThumbsUp className="h-4 w-4" />
          ) : (
            <ThumbsDown className="h-4 w-4" />
          )}
          You voted: {relay.user_vote === 'compelling' ? 'Compelling' : 'Not Compelling'}
        </div>
      ) : (
        <div className="flex gap-3">
          <button
            onClick={() => handleVote('compelling')}
            disabled={busy}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl',
              'text-sm font-mono font-semibold border transition-all',
              'bg-for-500/10 border-for-500/40 text-for-400',
              'hover:bg-for-500/20 hover:border-for-400',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
            Compelling
          </button>
          <button
            onClick={() => handleVote('not_compelling')}
            disabled={busy}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl',
              'text-sm font-mono font-semibold border transition-all',
              'bg-against-500/10 border-against-500/40 text-against-400',
              'hover:bg-against-500/20 hover:border-against-400',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
            Not compelling
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function WeeklyRelayClient() {
  const [data, setData] = useState<WeeklyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [relayState, setRelayState] = useState<WeeklyRelay | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchData = useCallback(async (off: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/relays/weekly?offset=${off}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed')
      const json = (await res.json()) as WeeklyResponse
      setData(json)
      setRelayState(json.relay)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData(0)
  }, [fetchData])

  function goToPrev() {
    const next = offset + 1
    setOffset(next)
    void fetchData(next)
  }

  function goToNext() {
    if (offset === 0) return
    const next = offset - 1
    setOffset(next)
    void fetchData(next)
  }

  function handleVote(vote: 'compelling' | 'not_compelling') {
    if (!relayState) return
    const vc = vote === 'compelling' ? relayState.vote_compelling + 1 : relayState.vote_compelling
    const vnc = vote === 'not_compelling' ? relayState.vote_not_compelling + 1 : relayState.vote_not_compelling
    const total = vc + vnc
    setRelayState({
      ...relayState,
      vote_compelling: vc,
      vote_not_compelling: vnc,
      compelling_pct: total > 0 ? Math.round((vc / total) * 100) : null,
      user_vote: vote,
    })
  }

  async function handleShare() {
    if (!relayState) return
    const url = `${window.location.origin}/relays/${relayState.id}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Relay of the Week · Lobby Market', url })
      } else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // best-effort
    }
  }

  const isFor = relayState?.side === 'for'
  const cfg = isFor ? SIDE_CONFIG.for : SIDE_CONFIG.against

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* ─── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <Link
            href="/relays"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Relays
          </Link>

          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Crown className="h-5 w-5 text-gold" />
                <h1 className="text-xl font-black font-mono text-white tracking-tight">
                  Relay of the Week
                </h1>
              </div>
              <p className="text-xs font-mono text-surface-500">
                The community&apos;s most compelling collaborative argument chain
              </p>
            </div>
            {relayState && (
              <button
                onClick={handleShare}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-300 hover:text-white hover:border-surface-400 transition-colors"
              >
                <Share2 className="h-3.5 w-3.5" />
                {copied ? 'Copied!' : 'Share'}
              </button>
            )}
          </div>
        </div>

        {/* ─── Week navigation ────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={goToPrev}
            disabled={loading}
            aria-label="Previous week"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev
          </button>

          <div className="flex-1 flex items-center justify-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-surface-500" />
            <span className="text-xs font-mono text-surface-400">
              {data ? (offset === 0 ? `This Week — ${data.week_label}` : `Week of ${formatWeekLabel(data.week_start_iso)}`) : '—'}
            </span>
          </div>

          <button
            onClick={goToNext}
            disabled={loading || offset === 0}
            aria-label="Next week"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* ─── Content ─────────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LoadingState />
            </motion.div>
          ) : !relayState ? (
            <motion.div key="empty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon={GitMerge}
                iconColor="text-surface-500"
                title={offset === 0 ? 'No champion yet this week' : 'No completed relays that week'}
                description={
                  offset === 0
                    ? 'Relay chains complete when all legs are filled. Check back once the community finishes a chain.'
                    : 'No relay chains were completed during this week.'
                }
                action={{ label: 'Browse open relays', href: '/relays' }}
              />
            </motion.div>
          ) : (
            <motion.div
              key={`relay-${relayState.id}-${offset}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* ─── Champion banner ──────────────────────────────────────── */}
              <div className={cn(
                'rounded-2xl border p-4',
                isFor
                  ? 'bg-gradient-to-br from-for-900/30 to-surface-200/20 border-for-700/40'
                  : 'bg-gradient-to-br from-against-900/30 to-surface-200/20 border-against-700/40'
              )}>
                {/* Trophy + week label */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold/15 border border-gold/30">
                    <Trophy className="h-3.5 w-3.5 text-gold" />
                    <span className="text-[11px] font-mono font-bold text-gold uppercase tracking-wider">
                      {offset === 0 ? "This Week's Champion" : 'Week Champion'}
                    </span>
                  </div>
                  <span className={cn('text-[11px] font-mono font-semibold uppercase tracking-wider', cfg.accent)}>
                    {cfg.label}
                  </span>
                  {data && (
                    <span className="ml-auto text-[11px] font-mono text-surface-600">
                      {data.total_completed_this_week} chain{data.total_completed_this_week !== 1 ? 's' : ''} competed
                    </span>
                  )}
                </div>

                {/* Topic */}
                {relayState.topic_statement && (
                  <div className="mb-3">
                    <p className={cn('text-[10px] font-mono uppercase tracking-widest mb-1', catColor(relayState.topic_category))}>
                      {relayState.topic_category ?? 'Topic'}
                    </p>
                    <Link
                      href={relayState.topic_id ? `/topic/${relayState.topic_id}` : '#'}
                      className="text-base font-bold font-mono text-white hover:text-for-300 transition-colors line-clamp-3 leading-snug"
                    >
                      {relayState.topic_statement}
                    </Link>
                  </div>
                )}

                {/* Stats row */}
                <div className="flex items-center gap-4 text-[11px] font-mono text-surface-500">
                  <span className="flex items-center gap-1">
                    <Link2 className="h-3 w-3" />
                    {relayState.legs.length} / {relayState.max_legs} legs
                  </span>
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3 text-for-500" />
                    {relayState.vote_compelling} compelling
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-gold" />
                    Score {relayState.league_score}
                  </span>
                  <Link
                    href={`/relays/${relayState.id}`}
                    className="ml-auto flex items-center gap-1 text-surface-400 hover:text-white transition-colors"
                  >
                    Full detail
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              {/* ─── Chain of arguments ───────────────────────────────────── */}
              <div className="rounded-2xl border border-surface-300/40 bg-surface-200/20 p-5">
                <div className="flex items-center gap-2 mb-5">
                  <GitMerge className={cn('h-4 w-4', cfg.accent)} />
                  <span className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
                    The Chain
                  </span>
                  <span className={cn(
                    'ml-auto text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border',
                    isFor
                      ? 'text-for-400 border-for-700/40 bg-for-900/20'
                      : 'text-against-400 border-against-700/40 bg-against-900/20'
                  )}>
                    {cfg.label}
                  </span>
                </div>

                <div className="space-y-0">
                  {relayState.legs.map((leg, idx) => (
                    <LegCard
                      key={leg.id}
                      leg={leg}
                      isFor={isFor}
                      isLast={idx === relayState.legs.length - 1}
                    />
                  ))}
                </div>
              </div>

              {/* ─── Community verdict ────────────────────────────────────── */}
              <VoteSection relay={relayState} onVote={handleVote} />

              {/* ─── Contributor gallery ──────────────────────────────────── */}
              {relayState.legs.length > 0 && (
                <ContributorGallery relay={relayState} />
              )}

              {/* ─── CTA row ──────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <Link
                  href="/relays/league"
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono font-semibold text-surface-300 hover:text-white hover:border-surface-400 transition-colors"
                >
                  <Trophy className="h-4 w-4" />
                  Full League
                </Link>
                <Link
                  href="/relays/create"
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-for-600 border border-for-500 text-xs font-mono font-semibold text-white hover:bg-for-500 transition-colors"
                >
                  <ArrowRight className="h-4 w-4" />
                  Start a Relay
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Reload ───────────────────────────────────────────────────────── */}
        {!loading && (
          <button
            onClick={() => void fetchData(offset)}
            className="mt-6 flex items-center gap-1.5 text-xs font-mono text-surface-600 hover:text-surface-400 transition-colors mx-auto"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
