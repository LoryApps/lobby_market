'use client'

/**
 * /relays/hall-of-fame — Relay Hall of Fame
 *
 * All-time greatest relay chains on Lobby Market:
 *   • Most compelling (highest compelling-vote %)
 *   • Longest chains (most legs filled)
 *   • Fastest completed (quickest team assembly)
 *   • Top contributors (citizens with the most relay legs)
 *   • Category champions (best relay per civic category)
 *
 * Distinct from:
 *   /relays/weekly   — relay of the week (recent window only)
 *   /relays/league   — competitive season ranking
 *   /relays/champions — individual leaderboard
 *   /relays          — browse active relays
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  ChevronRight,
  Crown,
  GitMerge,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  HallOfFameResponse,
  HallOfFameRelay,
  TopContributor,
  CategoryChampion,
} from '@/app/api/relays/hall-of-fame/route'

// ─── Category colors ──────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',       bg: 'bg-gold/10',       border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',    bg: 'bg-for-500/10',    border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',     bg: 'bg-purple/10',     border: 'border-purple/30' },
  Science:     { text: 'text-emerald',    bg: 'bg-emerald/10',    border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-for-300',    bg: 'bg-for-500/10',    border: 'border-for-400/30' },
  Culture:     { text: 'text-gold',       bg: 'bg-gold/10',       border: 'border-gold/30' },
  Health:      { text: 'text-against-300', bg: 'bg-against-400/10', border: 'border-against-400/30' },
  Environment: { text: 'text-emerald',    bg: 'bg-emerald/10',    border: 'border-emerald/30' },
  Education:   { text: 'text-purple',     bg: 'bg-purple/10',     border: 'border-purple/30' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function durationMs(start: string, end: string): number {
  return new Date(end).getTime() - new Date(start).getTime()
}

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// ─── Relay card (compact) ─────────────────────────────────────────────────────

function RelayCard({
  relay,
  rank,
  highlight,
}: {
  relay: HallOfFameRelay
  rank?: number
  highlight?: 'compelling' | 'legs' | 'speed'
}) {
  const sideColor = relay.side === 'for' ? 'text-for-400' : 'text-against-400'
  const sideBg = relay.side === 'for' ? 'bg-for-500/10' : 'bg-against-500/10'
  const sideBorder = relay.side === 'for' ? 'border-for-500/30' : 'border-against-500/30'

  return (
    <Link
      href={`/relays/${relay.id}`}
      className={cn(
        'flex items-start gap-3 p-3.5 rounded-xl transition-colors group',
        'bg-surface-200/60 border border-surface-300/60',
        'hover:bg-surface-200 hover:border-surface-400/60',
      )}
    >
      {rank !== undefined && (
        <div className={cn(
          'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg font-mono font-bold text-sm',
          rank === 1 ? 'bg-gold/20 text-gold border border-gold/40' :
          rank === 2 ? 'bg-surface-400/20 text-surface-500 border border-surface-400/30' :
          rank === 3 ? 'bg-amber-900/30 text-amber-400 border border-amber-700/30' :
          'bg-surface-300/30 text-surface-600 border border-surface-300/20',
        )}>
          {rank === 1 ? <Crown className="h-4 w-4" /> : `#${rank}`}
        </div>
      )}

      <div className="flex-1 min-w-0">
        {relay.topic_statement && (
          <p className="text-xs text-white font-medium leading-snug truncate mb-1">
            {relay.topic_statement}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold',
            sideBg, sideBorder, sideColor, 'border',
          )}>
            {relay.side === 'for' ? (
              <ThumbsUp className="h-2.5 w-2.5" />
            ) : (
              <ThumbsDown className="h-2.5 w-2.5" />
            )}
            {relay.side.toUpperCase()}
          </span>

          {relay.topic_category && (
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded font-mono',
              CATEGORY_COLORS[relay.topic_category]?.bg ?? 'bg-surface-300/30',
              CATEGORY_COLORS[relay.topic_category]?.text ?? 'text-surface-500',
            )}>
              {relay.topic_category}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1.5">
          {/* Compelling */}
          <span className={cn(
            'flex items-center gap-1 text-[11px] font-mono',
            highlight === 'compelling'
              ? relay.compelling_pct >= 70 ? 'text-emerald font-bold' : 'text-gold font-bold'
              : 'text-surface-500',
          )}>
            <Sparkles className="h-3 w-3" />
            {relay.compelling_pct}%
          </span>

          {/* Votes */}
          <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <ThumbsUp className="h-3 w-3" />
            {relay.vote_compelling}
          </span>

          {/* Legs */}
          <span className={cn(
            'flex items-center gap-1 text-[11px] font-mono',
            highlight === 'legs' ? 'text-for-400 font-bold' : 'text-surface-500',
          )}>
            <GitMerge className="h-3 w-3" />
            {relay.leg_count}/{relay.max_legs} legs
          </span>

          {/* Speed */}
          {relay.completed_at && highlight === 'speed' && (
            <span className="flex items-center gap-1 text-[11px] font-mono text-purple font-bold">
              <Timer className="h-3 w-3" />
              {formatDuration(durationMs(relay.created_at, relay.completed_at))}
            </span>
          )}
        </div>

        {relay.top_leg_content && (
          <p className="text-[11px] text-surface-500 mt-1.5 line-clamp-2 leading-relaxed italic">
            &ldquo;{relay.top_leg_content.slice(0, 100)}&hellip;&rdquo;
          </p>
        )}
      </div>

      <ChevronRight className="h-4 w-4 text-surface-600 flex-shrink-0 mt-1 group-hover:text-surface-400 transition-colors" />
    </Link>
  )
}

// ─── Contributor row ──────────────────────────────────────────────────────────

function ContributorRow({ contributor, rank }: { contributor: TopContributor; rank: number }) {
  const roleColors: Record<string, string> = {
    elder: 'text-gold',
    senator: 'text-purple',
    lawmaker: 'text-gold',
    debator: 'text-for-400',
    troll_catcher: 'text-emerald',
    person: 'text-surface-500',
  }

  return (
    <Link
      href={`/profile/${contributor.username}`}
      className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/40 border border-surface-300/40 hover:bg-surface-200/70 hover:border-surface-400/60 transition-colors"
    >
      <span className={cn(
        'flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg font-mono font-bold text-xs',
        rank === 1 ? 'bg-gold/20 text-gold border border-gold/30' :
        rank === 2 ? 'bg-surface-400/20 text-surface-400 border border-surface-400/20' :
        rank === 3 ? 'bg-amber-900/20 text-amber-400 border border-amber-700/20' :
        'bg-surface-300/20 text-surface-600',
      )}>
        {rank <= 3 ? <Trophy className={cn('h-3.5 w-3.5', rank === 1 ? 'text-gold' : rank === 2 ? 'text-surface-400' : 'text-amber-400')} /> : rank}
      </span>

      <Avatar
        src={contributor.avatar_url}
        fallback={contributor.display_name || contributor.username}
        size="sm"
      />

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white truncate">
          {contributor.display_name || contributor.username}
        </p>
        <p className={cn('text-[10px] font-mono', roleColors[contributor.role] ?? 'text-surface-500')}>
          @{contributor.username}
        </p>
      </div>

      <div className="flex-shrink-0 text-right">
        <p className="text-sm font-mono font-bold text-for-400">{contributor.relay_count}</p>
        <p className="text-[10px] text-surface-500 font-mono">relays</p>
      </div>
    </Link>
  )
}

// ─── Category champion tile ───────────────────────────────────────────────────

function CategoryChampionTile({ champion }: { champion: CategoryChampion }) {
  const colors = CATEGORY_COLORS[champion.category] ?? { text: 'text-surface-400', bg: 'bg-surface-300/20', border: 'border-surface-300/20' }
  const sideColor = champion.side === 'for' ? 'text-for-400' : 'text-against-400'

  return (
    <Link
      href={`/relays/${champion.relay_id}`}
      className={cn(
        'p-3 rounded-xl transition-colors group',
        'bg-surface-200/50 border hover:bg-surface-200 hover:border-surface-400/60',
        colors.border,
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={cn('text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border', colors.bg, colors.border, colors.text)}>
          {champion.category}
        </span>
        <span className={cn('text-[10px] font-mono font-bold uppercase', sideColor)}>
          {champion.side}
        </span>
      </div>

      {champion.topic_statement && (
        <p className="text-xs text-white font-medium line-clamp-2 leading-snug mb-2">
          {champion.topic_statement}
        </p>
      )}

      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-[11px] font-mono text-emerald font-semibold">
          <Sparkles className="h-3 w-3" />
          {champion.compelling_pct}% compelling
        </span>
        <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
          <GitMerge className="h-2.5 w-2.5" />
          {champion.leg_count} legs
        </span>
      </div>
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function HallOfFameClient() {
  const [data, setData] = useState<HallOfFameResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'compelling' | 'legs' | 'speed' | 'contributors' | 'categories'>('compelling')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/relays/hall-of-fame', { cache: 'no-store' })
      if (res.ok) setData(await res.json())
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const TABS = [
    { id: 'compelling', label: 'Most Compelling', icon: Sparkles, count: data?.most_compelling.length },
    { id: 'legs',       label: 'Longest Chains',  icon: GitMerge,  count: data?.longest_chains.length },
    { id: 'speed',      label: 'Fastest Built',   icon: Zap,       count: data?.fastest_completed.length },
    { id: 'contributors', label: 'Top Builders', icon: Users,     count: data?.top_contributors.length },
    { id: 'categories',   label: 'By Category',  icon: BarChart2, count: data?.category_champions.length },
  ] as const

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="mb-6">
          <Link
            href="/relays"
            className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Relays
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30">
                <Award className="h-5 w-5 text-gold" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">Hall of Fame</h1>
                <p className="text-xs font-mono text-surface-500 mt-0.5">
                  The greatest civic relay chains ever assembled
                </p>
              </div>
            </div>

            <button
              onClick={load}
              disabled={loading}
              aria-label="Refresh"
              className="flex-shrink-0 p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>

          {/* ── Stats strip ────────────────────────────────────────────── */}
          {data && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-4 gap-2 mt-5"
            >
              {[
                { label: 'Total Relays',     value: data.totals.total_relays,         color: 'text-for-400' },
                { label: 'Completed',        value: data.totals.total_completed,      color: 'text-emerald' },
                { label: 'Compelling Votes', value: data.totals.total_compelling_votes, color: 'text-gold' },
                { label: 'Avg Compelling',   value: `${data.totals.avg_compelling_pct}%`, color: 'text-purple', raw: true },
              ].map(({ label, value, color, raw }) => (
                <div
                  key={label}
                  className="flex flex-col items-center p-2.5 rounded-xl bg-surface-200/60 border border-surface-300/40"
                >
                  {raw ? (
                    <span className={cn('font-mono text-lg font-bold', color)}>{value}</span>
                  ) : (
                    <AnimatedNumber
                      value={typeof value === 'number' ? value : 0}
                      className={cn('font-mono text-lg font-bold', color)}
                    />
                  )}
                  <span className="text-[10px] text-surface-500 font-mono text-center mt-0.5 leading-tight">
                    {label}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </div>

        {/* ── Tab bar ──────────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 rounded-xl bg-surface-200/60 border border-surface-300/40 mb-5 overflow-x-auto scrollbar-none">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-semibold whitespace-nowrap transition-all flex-shrink-0',
                activeTab === id
                  ? 'bg-surface-100 text-white border border-surface-300'
                  : 'text-surface-500 hover:text-surface-700',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab content ──────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >

              {/* Most Compelling */}
              {activeTab === 'compelling' && (
                <div className="space-y-3">
                  <p className="text-[11px] font-mono text-surface-500 mb-4">
                    Ranked by community compelling-vote percentage (min. 3 votes).
                  </p>
                  {data?.most_compelling.length === 0 ? (
                    <EmptyState
                      icon={<Sparkles className="h-8 w-8" />}
                      title="No completed relays yet"
                      description="Complete a relay chain to appear in the Hall of Fame."
                      action={{ label: 'Browse relays', href: '/relays' }}
                    />
                  ) : (
                    data?.most_compelling.map((relay, i) => (
                      <RelayCard key={relay.id} relay={relay} rank={i + 1} highlight="compelling" />
                    ))
                  )}
                </div>
              )}

              {/* Longest Chains */}
              {activeTab === 'legs' && (
                <div className="space-y-3">
                  <p className="text-[11px] font-mono text-surface-500 mb-4">
                    Relay chains with the most legs filled in — the most collaborative efforts.
                  </p>
                  {data?.longest_chains.length === 0 ? (
                    <EmptyState
                      icon={<GitMerge className="h-8 w-8" />}
                      title="No relay chains yet"
                      description="Start or join a relay to build the first chain."
                      action={{ label: 'Start a relay', href: '/relays/create' }}
                    />
                  ) : (
                    data?.longest_chains.map((relay, i) => (
                      <RelayCard key={relay.id} relay={relay} rank={i + 1} highlight="legs" />
                    ))
                  )}
                </div>
              )}

              {/* Fastest Completed */}
              {activeTab === 'speed' && (
                <div className="space-y-3">
                  <p className="text-[11px] font-mono text-surface-500 mb-4">
                    Relay chains assembled at record speed — teams that came together fastest.
                  </p>
                  {data?.fastest_completed.length === 0 ? (
                    <EmptyState
                      icon={<Zap className="h-8 w-8" />}
                      title="No completed relays yet"
                      description="Complete a relay chain to set a speed record."
                      action={{ label: 'Browse relays', href: '/relays' }}
                    />
                  ) : (
                    data?.fastest_completed.map((relay, i) => (
                      <RelayCard key={relay.id} relay={relay} rank={i + 1} highlight="speed" />
                    ))
                  )}
                </div>
              )}

              {/* Top Contributors */}
              {activeTab === 'contributors' && (
                <div className="space-y-2">
                  <p className="text-[11px] font-mono text-surface-500 mb-4">
                    Citizens who have contributed the most relay legs across all chains.
                  </p>
                  {data?.top_contributors.length === 0 ? (
                    <EmptyState
                      icon={<Users className="h-8 w-8" />}
                      title="No relay contributors yet"
                      description="Join a relay chain to appear on the leaderboard."
                      action={{ label: 'Browse relays', href: '/relays' }}
                    />
                  ) : (
                    data?.top_contributors.map((contributor, i) => (
                      <ContributorRow key={contributor.user_id} contributor={contributor} rank={i + 1} />
                    ))
                  )}

                  <Link
                    href="/relays/champions"
                    className="flex items-center justify-center gap-2 mt-4 py-2.5 rounded-xl text-xs font-mono text-surface-500 hover:text-white border border-surface-300/40 hover:border-surface-400/60 bg-surface-200/40 hover:bg-surface-200 transition-colors"
                  >
                    View full relay leaderboard
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}

              {/* Category Champions */}
              {activeTab === 'categories' && (
                <div>
                  <p className="text-[11px] font-mono text-surface-500 mb-4">
                    The highest-rated relay chain in each civic category.
                  </p>
                  {data?.category_champions.length === 0 ? (
                    <EmptyState
                      icon={<BarChart2 className="h-8 w-8" />}
                      title="No category champions yet"
                      description="Complete relay chains across categories to crown champions."
                      action={{ label: 'Browse relays', href: '/relays' }}
                    />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {data?.category_champions.map((champion) => (
                        <CategoryChampionTile key={champion.category} champion={champion} />
                      ))}
                    </div>
                  )}
                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Footer links ─────────────────────────────────────────────── */}
        <div className="mt-8 pt-6 border-t border-surface-300/40 flex flex-wrap gap-3">
          {[
            { href: '/relays',         label: 'Browse relays' },
            { href: '/relays/weekly',  label: 'Relay of the week' },
            { href: '/relays/league',  label: 'Relay league' },
            { href: '/relays/create',  label: 'Start a relay' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200/50 border border-surface-300/40 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400/60 transition-colors"
            >
              {label}
              <ArrowRight className="h-3 w-3" />
            </Link>
          ))}
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
