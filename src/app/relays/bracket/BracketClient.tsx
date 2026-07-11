'use client'

/**
 * /relays/bracket — Relay Chain Tournament Bracket
 *
 * Weekly single-elimination tournament for completed relay chains.
 * Seeds are the top 8 completed relay chains, ranked by compelling vote
 * percentage × credibility + leg star quality. Standard bracket seeding:
 *   QF1: Seed 1 vs 8  |  QF2: Seed 4 vs 5
 *   QF3: Seed 2 vs 7  |  QF4: Seed 3 vs 6
 *
 * Distinct from:
 *   /relays/league    — ranked leaderboard (many entries, weekly)
 *   /relays/showdown  — FOR vs AGAINST on the same topic
 *   /relays/compare   — deep per-topic chain comparison
 *   /argument-battle  — individual argument bracket
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  Crown,
  GitMerge,
  RefreshCw,
  Swords,
  ThumbsUp,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  BracketRelay,
  BracketMatchup,
  BracketRound,
  BracketResponse,
} from '@/app/api/relays/bracket/route'

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

function seedLabel(seed: number): string {
  if (seed === 1) return '#1 Seed'
  if (seed === 2) return '#2 Seed'
  if (seed === 3) return '#3 Seed'
  return `#${seed}`
}

// ─── Mini relay card for bracket slots ───────────────────────────────────────

function BracketSlot({
  relay,
  isWinner,
  isLoser,
  isHighlighted,
  onClick,
}: {
  relay: BracketRelay
  isWinner: boolean
  isLoser: boolean
  isHighlighted: boolean
  onClick: () => void
}) {
  const isFor = relay.side === 'for'
  const totalVotes = relay.vote_compelling + relay.vote_not_compelling
  const pct = totalVotes > 0 ? Math.round((relay.vote_compelling / totalVotes) * 100) : null

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl border p-3 transition-all duration-200 group',
        isWinner
          ? isFor
            ? 'border-for-500/60 bg-for-500/10 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
            : 'border-against-500/60 bg-against-500/10 shadow-[0_0_12px_rgba(239,68,68,0.15)]'
          : isLoser
          ? 'border-surface-400/20 bg-surface-200/20 opacity-40'
          : isHighlighted
          ? 'border-gold/50 bg-gold/5 shadow-[0_0_8px_rgba(245,158,11,0.1)]'
          : 'border-surface-300/60 bg-surface-200/40 hover:border-surface-400 hover:bg-surface-200/80'
      )}
      aria-label={`Relay by @${relay.starter_username}: ${relay.topic_statement?.slice(0, 40) ?? 'Civic Relay'}`}
    >
      {/* Seed + side */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={cn(
          'text-[9px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border',
          isFor
            ? 'text-for-300 border-for-500/30 bg-for-500/10'
            : 'text-against-300 border-against-500/30 bg-against-500/10'
        )}>
          {isFor ? 'FOR' : 'AGN'}
        </span>
        <span className="text-[9px] font-mono text-surface-500">{seedLabel(relay.seed)}</span>
        {isWinner && (
          <Crown className="h-3 w-3 text-gold ml-auto" />
        )}
      </div>

      {/* Topic statement */}
      <p className="text-xs font-medium text-white leading-tight mb-1.5 line-clamp-2">
        {relay.topic_statement
          ? relay.topic_statement.length > 55
            ? relay.topic_statement.slice(0, 55) + '…'
            : relay.topic_statement
          : 'Civic Relay Chain'}
      </p>

      {/* Stats */}
      <div className="flex items-center gap-2 flex-wrap">
        {pct !== null && (
          <span className={cn(
            'text-[10px] font-mono flex items-center gap-0.5',
            pct >= 60 ? 'text-emerald' : pct >= 40 ? 'text-gold' : 'text-against-400'
          )}>
            <ThumbsUp className="h-2.5 w-2.5" />
            {pct}%
          </span>
        )}
        <span className="text-[10px] font-mono text-surface-500 flex items-center gap-0.5">
          <Zap className="h-2.5 w-2.5" />
          {relay.leg_count}/{relay.max_legs}
        </span>
        <span className="text-[10px] font-mono text-surface-600">
          @{relay.starter_username}
        </span>
      </div>
    </button>
  )
}

// ─── VS connector ─────────────────────────────────────────────────────────────

function VSConnector({ status }: { status: 'live' | 'decided' | 'tied' }) {
  return (
    <div className="flex items-center justify-center py-1">
      <span className={cn(
        'text-[9px] font-black font-mono tracking-widest px-2 py-0.5 rounded-full border',
        status === 'decided'
          ? 'text-gold border-gold/30 bg-gold/10'
          : status === 'tied'
          ? 'text-surface-500 border-surface-400/30 bg-surface-300/20'
          : 'text-purple border-purple/30 bg-purple/10'
      )}>
        {status === 'decided' ? 'WON' : status === 'tied' ? 'TIED' : 'VS'}
      </span>
    </div>
  )
}

// ─── One matchup card ─────────────────────────────────────────────────────────

function MatchupCard({
  matchup,
  onSelect,
}: {
  matchup: BracketMatchup
  onSelect: (relay: BracketRelay) => void
}) {
  return (
    <div className="rounded-2xl border border-surface-300/50 bg-surface-100/50 p-3 space-y-1">
      <BracketSlot
        relay={matchup.higher_seed}
        isWinner={matchup.winner_seed === matchup.higher_seed.seed}
        isLoser={matchup.winner_seed !== null && matchup.winner_seed !== matchup.higher_seed.seed}
        isHighlighted={false}
        onClick={() => onSelect(matchup.higher_seed)}
      />
      <VSConnector status={matchup.status} />
      <BracketSlot
        relay={matchup.lower_seed}
        isWinner={matchup.winner_seed === matchup.lower_seed.seed}
        isLoser={matchup.winner_seed !== null && matchup.winner_seed !== matchup.lower_seed.seed}
        isHighlighted={false}
        onClick={() => onSelect(matchup.lower_seed)}
      />
    </div>
  )
}

// ─── Detail panel for a selected relay ───────────────────────────────────────

function RelayDetailPanel({
  relay,
  onClose,
}: {
  relay: BracketRelay
  onClose: () => void
}) {
  const isFor = relay.side === 'for'
  const totalVotes = relay.vote_compelling + relay.vote_not_compelling
  const compellingPct = totalVotes > 0 ? Math.round((relay.vote_compelling / totalVotes) * 100) : null

  return (
    <motion.div
      key={relay.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="rounded-2xl border border-surface-300 bg-surface-100 p-5"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className={cn(
          'flex items-center justify-center h-10 w-10 rounded-xl border flex-shrink-0',
          isFor
            ? 'bg-for-500/10 border-for-500/30 text-for-400'
            : 'bg-against-500/10 border-against-500/30 text-against-400'
        )}>
          <GitMerge className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={cn(
              'text-[10px] font-black font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border',
              isFor
                ? 'text-for-300 border-for-500/30 bg-for-500/10'
                : 'text-against-300 border-against-500/30 bg-against-500/10'
            )}>
              {isFor ? 'FOR' : 'AGAINST'}
            </span>
            <span className="text-[10px] font-mono text-surface-500">
              Seed #{relay.seed}
            </span>
            {relay.topic_category && (
              <span className="text-[10px] font-mono text-surface-600 bg-surface-200/60 px-1.5 py-0.5 rounded-full border border-surface-400/20">
                {relay.topic_category}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-white leading-snug">
            {relay.topic_statement ?? 'Civic Relay Chain'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white transition-colors"
          aria-label="Close detail panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Opener */}
      {relay.opener_content && (
        <div className="mb-4 p-3 rounded-xl bg-surface-200/60 border border-surface-300/50">
          <p className="text-xs text-surface-600 font-mono mb-1">OPENER</p>
          <p className="text-sm text-surface-700 leading-relaxed line-clamp-4">
            {relay.opener_content}
          </p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-2 rounded-lg bg-surface-200/40 border border-surface-300/30">
          <p className="text-[10px] font-mono text-surface-500 uppercase mb-1">Compelling</p>
          <p className={cn(
            'text-lg font-black font-mono',
            compellingPct !== null && compellingPct >= 60 ? 'text-emerald' : 'text-gold'
          )}>
            {compellingPct !== null ? `${compellingPct}%` : '—'}
          </p>
        </div>
        <div className="text-center p-2 rounded-lg bg-surface-200/40 border border-surface-300/30">
          <p className="text-[10px] font-mono text-surface-500 uppercase mb-1">Votes</p>
          <p className="text-lg font-black font-mono text-white">{totalVotes}</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-surface-200/40 border border-surface-300/30">
          <p className="text-[10px] font-mono text-surface-500 uppercase mb-1">Legs</p>
          <p className="text-lg font-black font-mono text-white">
            {relay.leg_count}/{relay.max_legs}
          </p>
        </div>
      </div>

      {/* Starter */}
      <div className="flex items-center gap-2 mb-4">
        <Avatar
          src={relay.starter_avatar_url}
          fallback={relay.starter_display_name ?? relay.starter_username}
          size="xs"
        />
        <div className="min-w-0">
          <p className="text-xs text-surface-500 font-mono">
            Started by{' '}
            <Link
              href={`/profile/${relay.starter_username}`}
              className="text-white hover:text-for-300 transition-colors"
            >
              @{relay.starter_username}
            </Link>
            {relay.completed_at && (
              <span> · completed {relativeTime(relay.completed_at)}</span>
            )}
          </p>
        </div>
      </div>

      {/* Score */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-purple" />
          <span className="text-sm font-mono text-surface-500">
            Bracket score: <span className="text-purple font-bold">{relay.bracket_score}</span>
          </span>
        </div>
      </div>

      {/* CTA */}
      <Link
        href={`/relays/${relay.id}`}
        className={cn(
          'flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold border transition-all',
          isFor
            ? 'bg-for-500/15 border-for-500/40 text-for-300 hover:bg-for-500/25'
            : 'bg-against-500/15 border-against-500/40 text-against-300 hover:bg-against-500/25'
        )}
      >
        View Full Relay
        <ArrowRight className="h-4 w-4" />
      </Link>
    </motion.div>
  )
}

// ─── Bracket column ───────────────────────────────────────────────────────────

function BracketColumn({
  round,
  onSelect,
}: {
  round: BracketRound
  onSelect: (relay: BracketRelay) => void
}) {
  const labelColor =
    round.round === 3
      ? 'text-gold'
      : round.round === 2
      ? 'text-purple'
      : 'text-surface-500'

  return (
    <div className="flex flex-col gap-3">
      {/* Round label */}
      <div className="text-center mb-1">
        <span className={cn('text-[10px] font-black font-mono uppercase tracking-widest', labelColor)}>
          {round.label}
        </span>
      </div>

      {/* Matchup cards */}
      <div className={cn(
        'flex flex-col justify-around',
        round.round === 1 ? 'gap-3' : round.round === 2 ? 'gap-8' : 'gap-0'
      )}>
        {round.matchups.map((matchup) => (
          <MatchupCard
            key={matchup.match_id}
            matchup={matchup}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Seed table ───────────────────────────────────────────────────────────────

function SeedTable({
  seeds,
  onSelect,
}: {
  seeds: BracketRelay[]
  onSelect: (relay: BracketRelay) => void
}) {
  return (
    <div className="rounded-2xl border border-surface-300/50 bg-surface-100/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-300/40 flex items-center gap-2">
        <BarChart2 className="h-4 w-4 text-purple" />
        <span className="text-xs font-mono font-bold text-surface-400 uppercase tracking-wider">
          Bracket Seeds
        </span>
      </div>
      <div className="divide-y divide-surface-300/30">
        {seeds.map((relay) => {
          const totalVotes = relay.vote_compelling + relay.vote_not_compelling
          const pct = totalVotes > 0 ? Math.round((relay.vote_compelling / totalVotes) * 100) : null
          const isFor = relay.side === 'for'

          return (
            <button
              key={relay.id}
              onClick={() => onSelect(relay)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-200/40 transition-colors text-left group"
            >
              {/* Seed number */}
              <span className="text-xs font-black font-mono text-surface-500 w-5 flex-shrink-0">
                {relay.seed}
              </span>

              {/* Side badge */}
              <span className={cn(
                'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0',
                isFor
                  ? 'text-for-300 border-for-500/30 bg-for-500/10'
                  : 'text-against-300 border-against-500/30 bg-against-500/10'
              )}>
                {isFor ? 'FOR' : 'AGN'}
              </span>

              {/* Topic */}
              <span className="flex-1 text-xs text-surface-600 group-hover:text-white truncate transition-colors">
                {relay.topic_statement
                  ? relay.topic_statement.slice(0, 50)
                  : 'Civic Relay'}
              </span>

              {/* Score */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {pct !== null && (
                  <span className={cn(
                    'text-xs font-mono',
                    pct >= 60 ? 'text-emerald' : pct >= 40 ? 'text-gold' : 'text-against-400'
                  )}>
                    {pct}%
                  </span>
                )}
                <ChevronRight className="h-3 w-3 text-surface-600 group-hover:text-surface-400 transition-colors" />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Champion banner ──────────────────────────────────────────────────────────

function ChampionBanner({ champion }: { champion: BracketRelay }) {
  const isFor = champion.side === 'for'
  const totalVotes = champion.vote_compelling + champion.vote_not_compelling
  const pct = totalVotes > 0 ? Math.round((champion.vote_compelling / totalVotes) * 100) : null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'rounded-2xl border p-5 text-center',
        isFor
          ? 'bg-for-500/10 border-for-500/40 shadow-[0_0_32px_rgba(59,130,246,0.12)]'
          : 'bg-against-500/10 border-against-500/40 shadow-[0_0_32px_rgba(239,68,68,0.12)]'
      )}
    >
      <div className="flex items-center justify-center gap-2 mb-3">
        <Trophy className="h-6 w-6 text-gold" />
        <span className="text-sm font-black font-mono text-gold uppercase tracking-widest">
          This Week&apos;s Champion
        </span>
        <Trophy className="h-6 w-6 text-gold" />
      </div>
      <p className="text-base font-semibold text-white mb-2 max-w-md mx-auto leading-snug">
        {champion.topic_statement ?? 'Civic Relay Chain'}
      </p>
      <div className="flex items-center justify-center gap-3 mb-4">
        <span className={cn(
          'text-[10px] font-black font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border',
          isFor
            ? 'text-for-300 border-for-500/30 bg-for-500/10'
            : 'text-against-300 border-against-500/30 bg-against-500/10'
        )}>
          {isFor ? 'FOR' : 'AGAINST'}
        </span>
        {pct !== null && (
          <span className="text-sm font-mono text-emerald">{pct}% compelling</span>
        )}
        <span className="text-xs font-mono text-surface-500">
          by @{champion.starter_username}
        </span>
      </div>
      <Link
        href={`/relays/${champion.id}`}
        className={cn(
          'inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold border transition-all',
          isFor
            ? 'bg-for-500/20 border-for-500/50 text-for-300 hover:bg-for-500/30'
            : 'bg-against-500/20 border-against-500/50 text-against-300 hover:bg-against-500/30'
        )}
      >
        Read Champion Chain
        <ArrowRight className="h-4 w-4" />
      </Link>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BracketClient() {
  const [data, setData] = useState<BracketResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRelay, setSelectedRelay] = useState<BracketRelay | null>(null)
  const [activeView, setActiveView] = useState<'bracket' | 'seeds'>('bracket')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/relays/bracket', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load bracket')
      const json: BracketResponse = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function handleSelect(relay: BracketRelay) {
    setSelectedRelay((prev) => (prev?.id === relay.id ? null : relay))
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-12">
          <div className="flex items-center gap-2 mb-6">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="h-10 w-72 mb-2" />
          <Skeleton className="h-4 w-40 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-4 w-24 mx-auto" />
                {Array.from({ length: i === 0 ? 4 : i === 1 ? 2 : 1 }).map((_, j) => (
                  <Skeleton key={j} className="h-32 rounded-xl" />
                ))}
              </div>
            ))}
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-12 pb-24">
          <EmptyState
            icon={<Swords className="h-8 w-8" />}
            title="Bracket unavailable"
            description={error ?? 'Could not load the tournament bracket. Try again shortly.'}
            action={{ label: 'Retry', onClick: load }}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  const { seeds, rounds, champion, week_label, total_votes } = data

  // ── Empty: no completed relays ─────────────────────────────────────────────
  if (seeds.length === 0) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-12 pb-24">
          <EmptyState
            icon={<GitMerge className="h-8 w-8" />}
            title="No relays in bracket yet"
            description="Complete relay chains earn a spot in the weekly bracket. Start or join a relay to compete."
            action={{ label: 'Browse Relays', href: '/relays' }}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* ── Nav ───────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-6">
          <Link
            href="/relays"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            aria-label="Back to Relays"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Swords className="h-4 w-4 text-gold flex-shrink-0" />
            <span className="text-sm font-mono text-surface-500">Relay Bracket</span>
          </div>
          <button
            onClick={load}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            aria-label="Refresh bracket"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <h1 className="text-2xl font-black text-white tracking-tight mb-1">
            Relay Chain Tournament
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-mono text-surface-500">{week_label}</span>
            <span className="h-1 w-1 rounded-full bg-surface-500" />
            <span className="text-sm font-mono text-surface-500">
              {seeds.length} relay{seeds.length !== 1 ? 's' : null} competing
            </span>
            {total_votes > 0 && (
              <>
                <span className="h-1 w-1 rounded-full bg-surface-500" />
                <span className="text-sm font-mono text-surface-500">
                  {total_votes.toLocaleString()} community votes
                </span>
              </>
            )}
          </div>
        </div>

        {/* ── Champion (if decided) ──────────────────────────────────────── */}
        <AnimatePresence>
          {champion && (
            <div className="mb-6">
              <ChampionBanner champion={champion} />
            </div>
          )}
        </AnimatePresence>

        {/* ── View toggle ───────────────────────────────────────────────── */}
        <div className="flex rounded-xl border border-surface-300/50 bg-surface-200/30 p-1 mb-6 w-fit gap-1">
          {(['bracket', 'seeds'] as const).map((view) => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-mono font-semibold uppercase tracking-wider transition-all',
                activeView === view
                  ? 'bg-surface-300 text-white border border-surface-400/50 shadow-sm'
                  : 'text-surface-500 hover:text-surface-300'
              )}
            >
              {view === 'bracket' ? 'Bracket' : 'Seeds'}
            </button>
          ))}
        </div>

        {/* ── Content ───────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {activeView === 'bracket' ? (
            <motion.div
              key="bracket"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Bracket grid — scrollable on mobile */}
              <div className="overflow-x-auto pb-4">
                <div className="grid min-w-[640px] gap-6" style={{ gridTemplateColumns: 'repeat(3, minmax(200px, 1fr))' }}>
                  {rounds.map((round) => (
                    <BracketColumn
                      key={round.round}
                      round={round}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              </div>

              {/* Detail panel for selected relay */}
              <AnimatePresence>
                {selectedRelay && (
                  <div className="mt-6">
                    <RelayDetailPanel
                      relay={selectedRelay}
                      onClose={() => setSelectedRelay(null)}
                    />
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="seeds"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <SeedTable seeds={seeds} onSelect={handleSelect} />

              {/* Detail panel */}
              <AnimatePresence>
                {selectedRelay && (
                  <div className="mt-4">
                    <RelayDetailPanel
                      relay={selectedRelay}
                      onClose={() => setSelectedRelay(null)}
                    />
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── How it works ──────────────────────────────────────────────── */}
        <div className="mt-8 rounded-2xl border border-surface-300/40 bg-surface-100/40 p-5">
          <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-gold" />
            How the Bracket Works
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              {
                icon: <BarChart2 className="h-4 w-4 text-purple" />,
                title: 'Seeding',
                desc: 'Top 8 completed relay chains ranked by compelling vote percentage × credibility + leg star quality.',
              },
              {
                icon: <Swords className="h-4 w-4 text-against-400" />,
                title: 'Matchups',
                desc: 'Standard bracket: #1 vs #8, #4 vs #5, #2 vs #7, #3 vs #6. Higher compelling rate advances.',
              },
              {
                icon: <Crown className="h-4 w-4 text-gold" />,
                title: 'Champion',
                desc: 'The relay with the highest community compelling percentage at the Final is crowned this week\'s champion.',
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-3">
                <div className="flex-shrink-0 mt-0.5">{item.icon}</div>
                <div>
                  <p className="text-xs font-semibold text-white mb-0.5">{item.title}</p>
                  <p className="text-xs text-surface-600 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Quick links ───────────────────────────────────────────────── */}
        <div className="mt-6 flex flex-wrap gap-3">
          {[
            { label: 'League', href: '/relays/league' },
            { label: 'Hall of Fame', href: '/relays/hall-of-fame' },
            { label: 'Create Relay', href: '/relays/create' },
            { label: 'Browse Relays', href: '/relays' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200/60 border border-surface-300/50 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            >
              {link.label}
              <ArrowRight className="h-3 w-3" />
            </Link>
          ))}
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
