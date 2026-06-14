'use client'

/**
 * /leaderboard/arena — Argument Arena Champions
 *
 * Ranks citizens by their win rate in head-to-head argument faceoffs.
 * The Arena pits real arguments from different topics against each other;
 * the community votes on which makes the more compelling case — independent
 * of topic preference. This leaderboard aggregates those wins per author,
 * surfacing the platform's sharpest rhetorical minds.
 *
 * Qualification: ≥3 bouts to appear on the board.
 * Ranking: win% (≥5 bouts) → raw wins (< 5 bouts)
 *
 * Distinct from:
 *   /faceoffs           — the faceoff arena (argument-level board)
 *   /leaderboard/arguments — ranked by upvotes
 *   /leaderboard/grades    — ranked by AI score
 *   /arguments/faceoff     — play a faceoff matchup
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Crown,
  ExternalLink,
  Medal,
  MessageSquare,
  RefreshCw,
  Swords,
  Target,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ArenaChampion, ArenaLeaderboardResponse } from '@/app/api/leaderboard/arena/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
  lawmaker: 'Lawmaker',
  senator: 'Senator',
}

const ROLE_BADGE: Record<string, string> = {
  elder: 'border-gold/40 text-gold bg-gold/10',
  senator: 'border-purple/40 text-purple bg-purple/10',
  lawmaker: 'border-gold/60 text-gold bg-gold/20',
  debator: 'border-for-500/40 text-for-300 bg-for-500/10',
  troll_catcher: 'border-emerald/40 text-emerald bg-emerald/10',
  person: 'border-surface-400/40 text-surface-500 bg-surface-300/20',
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-300',
}

function rankIcon(rank: number) {
  if (rank === 1) return <Crown className="h-4 w-4 text-gold" aria-hidden />
  if (rank === 2) return <Medal className="h-4 w-4 text-surface-400" aria-hidden />
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-700" aria-hidden />
  return <span className="text-xs font-mono text-surface-500 w-4 text-center">#{rank}</span>
}

function winPctColor(pct: number): string {
  if (pct >= 70) return 'text-emerald'
  if (pct >= 55) return 'text-for-400'
  if (pct >= 40) return 'text-gold'
  return 'text-against-400'
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '…'
}

// ─── Champion row ─────────────────────────────────────────────────────────────

function ChampionRow({ champion, rank, expanded, onToggle }: {
  champion: ArenaChampion
  rank: number
  expanded: boolean
  onToggle: () => void
}) {
  const pctColor = winPctColor(champion.win_pct)
  const stableRate = champion.bouts >= 5

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.03 }}
      className={cn(
        'rounded-xl border overflow-hidden transition-colors',
        rank === 1
          ? 'border-gold/30 bg-gold/5'
          : rank <= 3
          ? 'border-surface-300/80 bg-surface-100/80'
          : 'border-surface-200/60 bg-surface-100/40',
      )}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors"
        aria-expanded={expanded}
      >
        {/* Rank */}
        <div className="flex-shrink-0 w-6 flex items-center justify-center">
          {rankIcon(rank)}
        </div>

        {/* Avatar */}
        <Avatar
          src={champion.avatar_url}
          fallback={champion.display_name ?? champion.username}
          size="sm"
          className="flex-shrink-0"
        />

        {/* Identity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">
              {champion.display_name ?? champion.username}
            </span>
            <span className={cn(
              'flex-shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border',
              ROLE_BADGE[champion.role] ?? ROLE_BADGE.person
            )}>
              {ROLE_LABEL[champion.role] ?? champion.role}
            </span>
            {champion.top_category && (
              <span className={cn(
                'flex-shrink-0 text-[10px] font-mono',
                CATEGORY_COLOR[champion.top_category] ?? 'text-surface-500'
              )}>
                {champion.top_category}
              </span>
            )}
          </div>
          <p className="text-[11px] text-surface-500 mt-0.5">@{champion.username}</p>
        </div>

        {/* Stats */}
        <div className="flex-shrink-0 flex items-center gap-4 ml-auto">
          <div className="text-right">
            <p className={cn('text-base font-bold font-mono', pctColor)}>
              {stableRate ? `${champion.win_pct}%` : `${champion.wins}W`}
            </p>
            <p className="text-[10px] text-surface-500 font-mono">
              {stableRate ? 'win rate' : 'wins'}
            </p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-mono text-white">{champion.wins}</p>
            <p className="text-[10px] text-surface-500 font-mono">wins</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-mono text-surface-400">{champion.bouts}</p>
            <p className="text-[10px] text-surface-500 font-mono">bouts</p>
          </div>
        </div>
      </button>

      {/* Expanded best argument */}
      <AnimatePresence initial={false}>
        {expanded && champion.best_argument_content && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-surface-200/40">
              <p className="text-[11px] text-surface-500 mb-2 font-mono uppercase tracking-wide">
                Best Argument — {champion.best_argument_wins} win{champion.best_argument_wins !== 1 ? 's' : ''}
              </p>
              {champion.best_topic_statement && (
                <p className={cn(
                  'text-[11px] mb-1.5 font-medium',
                  CATEGORY_COLOR[champion.best_topic_category ?? ''] ?? 'text-surface-500'
                )}>
                  Re: {truncate(champion.best_topic_statement, 80)}
                </p>
              )}
              <p className="text-sm text-surface-300 leading-relaxed">
                {truncate(champion.best_argument_content, 200)}
              </p>
              <div className="flex items-center gap-3 mt-3">
                <Link
                  href={`/profile/${champion.username}`}
                  className="text-[11px] text-for-400 hover:text-for-300 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  View profile
                </Link>
                {champion.best_argument_id && (
                  <Link
                    href={`/arguments/faceoff`}
                    className="flex items-center gap-1 text-[11px] text-surface-400 hover:text-white transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Swords className="h-3 w-3" aria-hidden />
                    Enter the Arena
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ChampionSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-surface-200/60 bg-surface-100/40">
      <Skeleton className="h-5 w-5 rounded" />
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-3.5 w-32 rounded" />
        <Skeleton className="h-2.5 w-20 rounded" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-5 w-10 rounded" />
        <Skeleton className="h-5 w-8 rounded hidden sm:block" />
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ArenaLeaderboardPage() {
  const [data, setData] = useState<ArenaLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/leaderboard/arena?limit=50')
      if (!res.ok) throw new Error('Failed to load')
      const json: ArenaLeaderboardResponse = await res.json()
      setData(json)
    } catch {
      setError('Could not load arena leaderboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/leaderboard"
            className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-200 transition-colors"
            aria-label="Back to leaderboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Swords className="h-5 w-5 text-gold flex-shrink-0" aria-hidden />
              <h1 className="text-lg font-bold text-white truncate">Argument Arena Champions</h1>
            </div>
            <p className="text-xs text-surface-500 mt-0.5">
              Ranked by head-to-head win rate · ≥3 bouts to qualify
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-200 transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Platform stats */}
        {data && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {data.stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl bg-surface-100 border border-surface-200 p-3 text-center"
              >
                <p className="text-lg font-bold text-white font-mono">{stat.value}</p>
                <p className="text-[10px] text-surface-400 mt-0.5 leading-tight">{stat.label}</p>
                {stat.sub && (
                  <p className="text-[9px] text-surface-500 mt-0.5 truncate">{stat.sub}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Column headers */}
        <div className="flex items-center gap-3 px-3 mb-2">
          <div className="w-6" />
          <div className="w-8" />
          <div className="flex-1 text-[10px] text-surface-500 uppercase tracking-wide font-mono">Citizen</div>
          <div className="flex items-center gap-4 ml-auto">
            <span className="text-[10px] text-surface-500 uppercase tracking-wide font-mono w-14 text-right">Rate</span>
            <span className="text-[10px] text-surface-500 uppercase tracking-wide font-mono w-8 text-right hidden sm:block">W</span>
            <span className="text-[10px] text-surface-500 uppercase tracking-wide font-mono w-8 text-right hidden sm:block">B</span>
          </div>
        </div>

        {/* Champions list */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => <ChampionSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-surface-200 bg-surface-100 p-6 text-center">
            <p className="text-surface-400 text-sm">{error}</p>
            <button onClick={load} className="mt-3 text-xs text-for-400 hover:text-for-300">
              Try again
            </button>
          </div>
        ) : !data || data.champions.length === 0 ? (
          <EmptyState
            icon={Swords}
            title="No Champions Yet"
            description="Head-to-head faceoffs haven't started yet. Be the first to enter the arena and cast your vote on which argument makes the stronger case."
            action={
              <Link
                href="/arguments/faceoff"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-700 text-white text-sm font-semibold transition-colors"
              >
                <Swords className="h-4 w-4" aria-hidden />
                Enter the Arena
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {data.champions.map((champion, i) => (
              <ChampionRow
                key={champion.user_id}
                champion={champion}
                rank={i + 1}
                expanded={expandedId === champion.user_id}
                onToggle={() => setExpandedId(expandedId === champion.user_id ? null : champion.user_id)}
              />
            ))}
          </div>
        )}

        {/* Qualification note */}
        <p className="text-[11px] text-surface-500 text-center mt-6 px-4">
          Minimum 3 bouts to qualify · Win rate shown for ≥5 bouts · Updated in real-time
        </p>

        {/* CTA */}
        <div className="mt-8 rounded-xl bg-gradient-to-br from-surface-100 to-surface-200/50 border border-surface-200 p-5 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Swords className="h-5 w-5 text-gold" aria-hidden />
            <h2 className="text-sm font-bold text-white">Enter the Argument Arena</h2>
          </div>
          <p className="text-xs text-surface-400 mb-4 max-w-xs mx-auto">
            Judge head-to-head argument matchups. Your votes shape this leaderboard — and your own arguments can earn a place on it.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/arguments/faceoff"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold/20 hover:bg-gold/30 text-gold border border-gold/30 text-sm font-semibold transition-colors"
            >
              <Swords className="h-4 w-4" aria-hidden />
              Judge a Matchup
            </Link>
            <Link
              href="/faceoffs"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-white border border-surface-300 text-sm font-medium transition-colors"
            >
              <Trophy className="h-4 w-4" aria-hidden />
              Argument Rankings
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>

        {/* Related leaderboards */}
        <div className="mt-6">
          <p className="text-[11px] text-surface-500 uppercase tracking-wide font-mono mb-3 px-1">Related Leaderboards</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: '/leaderboard/arguments', icon: MessageSquare, label: 'Top Arguments', sub: 'by upvotes' },
              { href: '/leaderboard/grades', icon: Zap, label: 'Argument Quality', sub: 'AI grade avg' },
              { href: '/leaderboard/debates', icon: Target, label: 'Top Debaters', sub: 'formal wins' },
              { href: '/leaderboard', icon: Trophy, label: 'Main Board', sub: 'overall clout' },
            ].map(({ href, icon: Icon, label, sub }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-100/60 border border-surface-200/60 hover:border-surface-300 transition-colors"
              >
                <Icon className="h-4 w-4 text-surface-400 flex-shrink-0" aria-hidden />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate">{label}</p>
                  <p className="text-[10px] text-surface-500">{sub}</p>
                </div>
                <ExternalLink className="h-3 w-3 text-surface-500 ml-auto flex-shrink-0" aria-hidden />
              </Link>
            ))}
          </div>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
