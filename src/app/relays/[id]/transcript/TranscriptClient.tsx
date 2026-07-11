'use client'

/**
 * /relays/[id]/transcript — Relay Position Paper
 *
 * Renders a completed relay chain as a flowing civic essay / position paper.
 * Each leg appears as a numbered paragraph, with contributor attribution at
 * the end. Designed for reading, sharing, and printing.
 *
 * Distinct from:
 *   /relays/[id]             — card-by-card view of individual legs
 *   /relays/[id]/intelligence — AI analysis and scoring
 *   /relays/showdown         — head-to-head comparison of FOR vs AGAINST chains
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  GitMerge,
  Loader2,
  MessageCircle,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type { RelayRow, RelayLeg } from '@/app/api/relays/route'

// ─── Extended type from the detail API ───────────────────────────────────────

interface RelayDetail extends RelayRow {
  topic_blue_pct?: number
  topic_total_votes?: number
}

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
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function roleLabel(role: string): string {
  switch (role) {
    case 'elder': return 'Elder'
    case 'troll_catcher': return 'Troll Catcher'
    case 'debator': return 'Debator'
    default: return 'Citizen'
  }
}

function roleColor(role: string): string {
  switch (role) {
    case 'elder': return 'text-gold'
    case 'troll_catcher': return 'text-emerald'
    case 'debator': return 'text-for-400'
    default: return 'text-surface-400'
  }
}

function buildTranscriptText(relay: RelayDetail): string {
  const side = relay.side === 'for' ? 'FOR' : 'AGAINST'
  const topic = relay.topic_statement ?? 'Untitled Topic'
  const header = `CIVIC RELAY — ${side}: ${topic}\n${'─'.repeat(60)}\n\n`

  const body = relay.legs
    .map((leg, i) => {
      const author = leg.author
        ? (leg.author.display_name ?? leg.author.username)
        : 'Anonymous'
      return `[${i + 1}] ${leg.content}\n    — ${author}`
    })
    .join('\n\n')

  const contributors = relay.legs
    .map((l) => l.author ? `@${l.author.username}` : 'anon')
    .join(', ')

  const votes = relay.vote_compelling + relay.vote_not_compelling
  const footer = `\n\n${'─'.repeat(60)}\nContributors: ${contributors}\nVotes cast: ${votes} · Compelling: ${relay.vote_compelling}\nSource: https://lobby.market/relays/${relay.id}`

  return header + body + footer
}

// ─── Ordinal helper ───────────────────────────────────────────────────────────

function ordinal(n: number): string {
  const suffix = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (suffix[(v - 20) % 10] ?? suffix[v] ?? suffix[0])
}

// ─── Leg paragraph ────────────────────────────────────────────────────────────

function LegParagraph({
  leg,
  index,
  isFor,
  total,
}: {
  leg: RelayLeg
  index: number
  isFor: boolean
  total: number
}) {
  const accentColor = isFor ? 'bg-for-500' : 'bg-against-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="relative pl-5"
    >
      {/* Vertical accent stripe */}
      <div className={cn('absolute left-0 top-1 bottom-1 w-0.5 rounded-full opacity-50', accentColor)} />

      {/* Content */}
      <p className="text-base text-surface-700 leading-relaxed">
        {leg.content}
      </p>

      {/* Attribution */}
      <div className="flex items-center gap-2 mt-2">
        {leg.author && (
          <Link
            href={`/profile/${leg.author.username}`}
            className="flex items-center gap-1.5 group"
          >
            <Avatar
              src={leg.author.avatar_url}
              fallback={leg.author.display_name ?? leg.author.username}
              size="xs"
            />
            <span className={cn(
              'text-xs font-mono transition-colors group-hover:text-white',
              roleColor(leg.author.role),
            )}>
              {leg.author.display_name ?? leg.author.username}
            </span>
          </Link>
        )}
        <span className="text-[11px] text-surface-600 font-mono">
          · {ordinal(index + 1)} leg · {relativeTime(leg.created_at)}
        </span>
        {index === total - 1 && (
          <span className="ml-auto text-[11px] font-mono text-emerald">
            ✦ final
          </span>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TranscriptClientProps {
  relayId: string
  initialSide: string
}

export function TranscriptClient({ relayId, initialSide }: TranscriptClientProps) {
  const [relay, setRelay] = useState<RelayDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const isFor = (relay?.side ?? initialSide) === 'for'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/relays/${relayId}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load relay')
      const json = await res.json()
      setRelay(json.relay as RelayDetail)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load relay')
    } finally {
      setLoading(false)
    }
  }, [relayId])

  useEffect(() => { load() }, [load])

  const handleCopy = useCallback(() => {
    if (!relay) return
    navigator.clipboard.writeText(buildTranscriptText(relay)).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [relay])

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 text-surface-500 animate-spin" />
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ─── Error ────────────────────────────────────────────────────────────────

  if (error || !relay) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
          <div className="text-center py-20 space-y-4">
            <p className="text-surface-500 font-mono text-sm">{error ?? 'Relay not found'}</p>
            <button
              onClick={load}
              className="flex items-center gap-1.5 mx-auto text-xs text-surface-500 hover:text-white font-mono transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  const totalVotes = relay.vote_compelling + relay.vote_not_compelling
  const compellingPct = totalVotes > 0
    ? Math.round((relay.vote_compelling / totalVotes) * 100)
    : null

  const isComplete = relay.status === 'complete' || relay.status === 'voted'

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* ── Back nav ── */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href={`/relays/${relayId}`}
            className="flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to relay
          </Link>

          <div className="flex items-center gap-2">
            {/* Copy transcript */}
            <button
              onClick={handleCopy}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all',
                copied
                  ? 'bg-emerald/10 border-emerald/30 text-emerald'
                  : 'bg-surface-200/60 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
              )}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy text'}
            </button>

            {/* Intelligence link */}
            <Link
              href={`/relays/${relayId}/intelligence`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-300 bg-surface-200/60 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
            >
              <Zap className="h-3.5 w-3.5" />
              Intel
            </Link>
          </div>
        </div>

        {/* ── Document header ── */}
        <div className="mb-8">
          {/* Position badge */}
          <div className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono font-bold mb-4',
            isFor
              ? 'bg-for-500/15 border-for-500/40 text-for-300'
              : 'bg-against-500/15 border-against-500/40 text-against-300',
          )}>
            {isFor
              ? <ThumbsUp className="h-3.5 w-3.5" />
              : <ThumbsDown className="h-3.5 w-3.5" />}
            {isFor ? 'FOR' : 'AGAINST'}
          </div>

          {/* Topic statement */}
          {relay.topic_statement && (
            <h1 className="text-xl md:text-2xl font-semibold text-white leading-snug mb-3">
              {relay.topic_statement}
            </h1>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-surface-500">
            {relay.topic_category && (
              <span className="text-surface-400">{relay.topic_category}</span>
            )}
            {relay.completed_at ? (
              <span>Completed {formatDate(relay.completed_at)}</span>
            ) : (
              <span>{relay.legs.length} of {relay.max_legs} legs</span>
            )}
            {totalVotes > 0 && compellingPct !== null && (
              <span className={cn(
                compellingPct >= 60 ? 'text-emerald' : compellingPct <= 40 ? 'text-against-400' : 'text-surface-400',
              )}>
                {compellingPct}% compelling ({totalVotes} votes)
              </span>
            )}
            {relay.topic_id && (
              <Link
                href={`/topic/${relay.topic_id}`}
                className="flex items-center gap-0.5 hover:text-white transition-colors"
              >
                View topic <ExternalLink className="h-2.5 w-2.5" />
              </Link>
            )}
          </div>
        </div>

        {/* ── Divider ── */}
        <div className={cn(
          'h-px w-full mb-8 opacity-30',
          isFor ? 'bg-for-400' : 'bg-against-400',
        )} />

        {/* ── Position paper body ── */}
        {relay.legs.length === 0 ? (
          <div className="text-center py-12">
            <GitMerge className="h-8 w-8 text-surface-600 mx-auto mb-3" />
            <p className="text-surface-500 font-mono text-sm">No legs written yet.</p>
            <Link
              href={`/relays/${relayId}`}
              className="mt-3 inline-block text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              Join the relay →
            </Link>
          </div>
        ) : (
          <div className="space-y-7">
            {relay.legs.map((leg, i) => (
              <LegParagraph
                key={leg.id}
                leg={leg}
                index={i}
                isFor={isFor}
                total={relay.legs.length}
              />
            ))}
          </div>
        )}

        {/* ── Divider ── */}
        {relay.legs.length > 0 && (
          <div className={cn(
            'h-px w-full mt-8 mb-6 opacity-20',
            isFor ? 'bg-for-400' : 'bg-against-400',
          )} />
        )}

        {/* ── Contributors ── */}
        {relay.legs.length > 0 && (
          <div className="mb-8">
            <p className="text-xs font-mono text-surface-600 uppercase tracking-wider mb-3">
              Contributors
            </p>
            <div className="flex flex-wrap gap-3">
              {relay.legs.map((leg) => {
                if (!leg.author) return null
                return (
                  <Link
                    key={leg.id}
                    href={`/profile/${leg.author.username}`}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors"
                  >
                    <Avatar
                      src={leg.author.avatar_url}
                      fallback={leg.author.display_name ?? leg.author.username}
                      size="xs"
                    />
                    <span className="text-xs font-mono text-surface-400 hover:text-white transition-colors">
                      @{leg.author.username}
                    </span>
                    <span className={cn('text-[10px] font-mono', roleColor(leg.author.role))}>
                      {roleLabel(leg.author.role)}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Vote tally card ── */}
        {isComplete && totalVotes > 0 && (
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 mb-6">
            <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">
              Community verdict
            </p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <ThumbsUp className="h-4 w-4 text-emerald" />
                <span className="text-sm font-mono font-bold text-emerald">
                  {relay.vote_compelling}
                </span>
                <span className="text-xs text-surface-500">compelling</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ThumbsDown className="h-4 w-4 text-against-400" />
                <span className="text-sm font-mono font-bold text-against-400">
                  {relay.vote_not_compelling}
                </span>
                <span className="text-xs text-surface-500">not compelling</span>
              </div>
              {compellingPct !== null && (
                <div className="ml-auto">
                  <span className={cn(
                    'text-sm font-mono font-bold',
                    compellingPct >= 60 ? 'text-emerald' : compellingPct <= 40 ? 'text-against-400' : 'text-surface-400',
                  )}>
                    {compellingPct}%
                  </span>
                  <span className="text-xs text-surface-500 ml-1">compelling</span>
                </div>
              )}
            </div>

            {/* Bar */}
            {compellingPct !== null && (
              <div className="mt-3 h-1.5 rounded-full bg-surface-300 overflow-hidden">
                <div
                  className="h-full bg-emerald rounded-full transition-all"
                  style={{ width: `${compellingPct}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            href={`/relays/${relayId}`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-surface-300 bg-surface-200/60 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to relay
          </Link>

          {relay.topic_id && (
            <Link
              href={`/topic/${relay.topic_id}/relays`}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-surface-300 bg-surface-200/60 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
            >
              <Users className="h-4 w-4" />
              All topic relays
            </Link>
          )}

          <Link
            href={`/relays/${relayId}/discussion`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-surface-300 bg-surface-200/60 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            Discussion
          </Link>

          <Link
            href={`/relays/${relayId}/intelligence`}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-mono font-semibold transition-colors',
              isFor
                ? 'border-for-500/40 bg-for-500/10 text-for-300 hover:bg-for-500/20'
                : 'border-against-500/40 bg-against-500/10 text-against-300 hover:bg-against-500/20',
            )}
          >
            <Zap className="h-4 w-4" />
            Intelligence report
          </Link>
        </div>

        {/* ── Footer note ── */}
        <p className="mt-8 text-center text-xs font-mono text-surface-600">
          This is a collaborative civic position paper written by {relay.legs.length} contributor{relay.legs.length !== 1 ? 's' : ''}{' '}
          on Lobby Market. Each paragraph represents one citizen&apos;s contribution to a shared argument.{' '}
          <Link href="/relays" className="text-for-400 hover:text-for-300 transition-colors">
            Start your own relay →
          </Link>
        </p>
      </main>

      <BottomNav />
    </div>
  )
}
