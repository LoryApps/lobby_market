'use client'

/**
 * /hall-of-fame — The Civic Hall of Fame
 *
 * A prestige showcase celebrating Lobby Market's landmark laws, category
 * champions, and top civic contributors. Not a leaderboard reset, not a
 * personal analytics page — this is the platform's permanent record of
 * its greatest democratic achievements.
 *
 * Sections:
 *   Landmark Laws      — Top 5 laws by total votes (highest democratic mandate)
 *   Unanimous Victories — Laws that passed with the strongest consensus
 *   Hard-Won Laws       — Laws that passed with the narrowest majority (≤ 72%)
 *   Category Champions  — The defining law for each of the 10 civic categories
 *   Top Contributors    — Citizens with the highest reputation scores
 *
 * Distinct from:
 *   /leaderboard/legends  — all-time personal record holders (fastest, most, highest)
 *   /law                  — browsable Codex of all laws (not curated)
 *   /law/ratings          — laws ranked by post-establishment star reviews
 *   /law/quality          — democratic mandate score
 *   /arguments/hall-of-fame — argument-level hall of fame
 *   /reputation           — personal reputation breakdown
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Award,
  BarChart2,
  ChevronRight,
  Crown,
  Cpu,
  DollarSign,
  ExternalLink,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  MessageSquare,
  Music2,
  RefreshCw,
  Scale,
  Sparkles,
  Star,
  ThumbsUp,
  Trophy,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { HallOfFameResponse, HallLaw, HallContributor } from '@/app/api/hall-of-fame/route'

// ─── Category visual config ────────────────────────────────────────────────────

const CATEGORY_META: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>
    color: string
    bg: string
    border: string
  }
> = {
  Economics:   { icon: DollarSign,    color: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30' },
  Politics:    { icon: Landmark,      color: 'text-for-400',      bg: 'bg-for-500/10',      border: 'border-for-500/30' },
  Technology:  { icon: Cpu,           color: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/30' },
  Science:     { icon: FlaskConical,  color: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30' },
  Ethics:      { icon: Scale,         color: 'text-against-400',  bg: 'bg-against-500/10',  border: 'border-against-500/30' },
  Philosophy:  { icon: Star,          color: 'text-for-300',      bg: 'bg-for-300/10',      border: 'border-for-300/30' },
  Culture:     { icon: Music2,        color: 'text-against-300',  bg: 'bg-against-400/10',  border: 'border-against-400/30' },
  Health:      { icon: Heart,         color: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30' },
  Environment: { icon: Leaf,          color: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30' },
  Education:   { icon: GraduationCap, color: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30' },
}

function catMeta(category: string | null) {
  if (!category) return { icon: Trophy, color: 'text-surface-400', bg: 'bg-surface-200', border: 'border-surface-300' }
  return CATEGORY_META[category] ?? { icon: Trophy, color: 'text-surface-400', bg: 'bg-surface-200', border: 'border-surface-300' }
}

// ─── Role display ───────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  person:        { label: 'Citizen',      color: 'text-surface-500' },
  debator:       { label: 'Debator',      color: 'text-for-400' },
  troll_catcher: { label: 'Troll Catcher', color: 'text-emerald' },
  elder:         { label: 'Elder',         color: 'text-gold' },
}

function roleConfig(role: string) {
  return ROLE_CONFIG[role] ?? { label: role, color: 'text-surface-500' }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function fmtPct(n: number): string {
  return `${Math.round(n)}%`
}

function relDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Law Row ──────────────────────────────────────────────────────────────────

function LawRow({
  law,
  rank,
  rankColor = 'text-surface-500',
  rankBg = 'bg-surface-300/40',
  showConsensus = true,
}: {
  law: HallLaw
  rank?: number
  rankColor?: string
  rankBg?: string
  showConsensus?: boolean
}) {
  const meta = catMeta(law.category)
  const CatIcon = meta.icon

  return (
    <Link
      href={`/law/${law.id}`}
      className="flex items-start gap-3 p-4 rounded-xl border border-surface-300/60 bg-surface-100/60 hover:bg-surface-200/60 hover:border-surface-400/60 transition-colors group"
    >
      {rank !== undefined && (
        <span
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg text-sm font-mono font-bold',
            rankBg,
            rankColor
          )}
        >
          {rank}
        </span>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-mono text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
          {law.statement}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          {law.category && (
            <span className={cn('flex items-center gap-1 text-[11px] font-mono font-semibold', meta.color)}>
              <CatIcon className="h-3 w-3" aria-hidden />
              {law.category}
            </span>
          )}
          <span className="text-[11px] font-mono text-surface-500">
            {relDate(law.established_at)}
          </span>
        </div>
      </div>

      <div className="flex-shrink-0 text-right space-y-1">
        <p className="text-xs font-mono font-semibold text-white">
          {fmtVotes(law.total_votes)}
          <span className="text-[10px] text-surface-500 ml-0.5">votes</span>
        </p>
        {showConsensus && (
          <p className="text-[11px] font-mono font-semibold text-for-400">
            {fmtPct(law.blue_pct)} FOR
          </p>
        )}
        <ExternalLink className="h-3 w-3 text-surface-600 group-hover:text-surface-400 ml-auto" aria-hidden />
      </div>
    </Link>
  )
}

// ─── Contributor Row ──────────────────────────────────────────────────────────

function ContributorRow({
  contributor,
  rank,
}: {
  contributor: HallContributor
  rank: number
}) {
  const { label, color } = roleConfig(contributor.role)
  const rankColors = [
    { text: 'text-gold', bg: 'bg-gold/15' },
    { text: 'text-surface-300', bg: 'bg-surface-300/20' },
    { text: 'text-against-400', bg: 'bg-against-500/15' },
    { text: 'text-surface-500', bg: 'bg-surface-300/10' },
    { text: 'text-surface-500', bg: 'bg-surface-300/10' },
  ]
  const rc = rankColors[rank - 1] ?? rankColors[3]

  return (
    <Link
      href={`/profile/${contributor.username}`}
      className="flex items-center gap-3 p-3.5 rounded-xl border border-surface-300/60 bg-surface-100/60 hover:bg-surface-200/60 hover:border-surface-400/60 transition-colors group"
    >
      <span
        className={cn(
          'flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg text-sm font-mono font-bold',
          rc.bg,
          rc.text
        )}
      >
        {rank}
      </span>

      <Avatar
        src={contributor.avatar_url}
        fallback={contributor.display_name || contributor.username}
        size="sm"
      />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-mono font-semibold text-white truncate group-hover:text-for-300 transition-colors">
          {contributor.display_name || contributor.username}
        </p>
        <p className={cn('text-[11px] font-mono', color)}>
          {label}
        </p>
      </div>

      <div className="flex-shrink-0 text-right space-y-0.5">
        <p className="text-xs font-mono font-bold text-gold">
          {contributor.reputation_score.toLocaleString()}
          <span className="text-[10px] text-surface-500 ml-0.5 font-normal">rep</span>
        </p>
        <p className="text-[11px] font-mono text-surface-500">
          {fmtVotes(contributor.clout)} clout
        </p>
      </div>
    </Link>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function HallOfFamePage() {
  const [data, setData] = useState<HallOfFameResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/hall-of-fame', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed')
      const json = (await res.json()) as HallOfFameResponse
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const categoryChampionEntries = data
    ? (Object.entries(data.categoryChampions) as [string, HallLaw][]).sort((a, b) =>
        a[0].localeCompare(b[0])
      )
    : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* ── Hero ─────────────────────────────────────────────────── */}
        <div className="mb-8 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gold/15 border border-gold/40 mb-4"
          >
            <Trophy className="h-8 w-8 text-gold" />
          </motion.div>
          <h1 className="font-mono text-3xl font-bold text-white mb-2">
            Hall of Fame
          </h1>
          <p className="text-sm font-mono text-surface-500 max-w-md mx-auto">
            Lobby Market&rsquo;s landmark laws, unanimous victories, and the citizens
            who shaped them. The permanent record of civic achievement.
          </p>

          <div className="flex items-center justify-center gap-3 mt-4">
            <Link
              href="/law"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-gold hover:text-gold/80 transition-colors"
            >
              Browse the Codex
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
            <span className="text-surface-600">·</span>
            <Link
              href="/arguments/hall-of-fame"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-purple hover:text-purple/80 transition-colors"
            >
              Arguments Hall of Fame
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>

        {/* ── Loading / Error ───────────────────────────────────────── */}
        {loading && <PageSkeleton />}

        {error && !loading && (
          <EmptyState
            icon={<Trophy className="h-8 w-8 text-surface-500" />}
            title="Couldn&rsquo;t load Hall of Fame"
            description="Something went wrong. Try again."
            action={
              <button
                onClick={load}
                className="flex items-center gap-2 px-4 py-2 text-sm font-mono bg-surface-200 hover:bg-surface-300 text-white rounded-lg transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            }
          />
        )}

        <AnimatePresence>
          {data && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-10"
            >
              {/* ── Platform Stats Strip ────────────────────────────── */}
              <section>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      icon: <Trophy className="h-4 w-4 text-gold" />,
                      label: 'Laws Established',
                      value: data.stats.total_laws,
                      color: 'text-gold',
                    },
                    {
                      icon: <Vote className="h-4 w-4 text-for-400" />,
                      label: 'Total Votes Cast',
                      value: data.stats.total_votes_on_laws,
                      color: 'text-for-400',
                      format: fmtVotes,
                    },
                    {
                      icon: <Sparkles className="h-4 w-4 text-emerald" />,
                      label: 'Active Categories',
                      value: data.stats.categories_with_laws,
                      color: 'text-emerald',
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="flex flex-col items-center justify-center gap-1 p-4 rounded-xl border border-surface-300/60 bg-surface-100/80 text-center"
                    >
                      <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200/60">
                        {stat.icon}
                      </div>
                      <p className={cn('text-xl font-mono font-bold', stat.color)}>
                        <AnimatedNumber
                          value={stat.format ? parseInt(fmtVotes(stat.value).replace(/[^0-9]/g, '')) : stat.value}
                        />
                        {stat.format ? fmtVotes(stat.value).replace(/[0-9]/g, '') : ''}
                      </p>
                      <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>

                {data.stats.newest_law && (
                  <div className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gold/20 bg-gold/5">
                    <Zap className="h-3.5 w-3.5 text-gold flex-shrink-0" aria-hidden />
                    <p className="text-xs font-mono text-surface-500 flex-1 min-w-0">
                      Most recent:{' '}
                      <Link
                        href={`/law/${data.stats.newest_law.id}`}
                        className="text-gold hover:text-gold/80 transition-colors truncate"
                      >
                        {data.stats.newest_law.statement.slice(0, 80)}
                        {data.stats.newest_law.statement.length > 80 ? '…' : ''}
                      </Link>
                    </p>
                  </div>
                )}
              </section>

              {/* ── Top Laws by Votes ────────────────────────────────── */}
              {data.topByVotes.length > 0 && (
                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gold/10 border border-gold/30">
                      <BarChart2 className="h-4 w-4 text-gold" aria-hidden />
                    </div>
                    <div>
                      <h2 className="font-mono text-base font-bold text-white">
                        Highest Democratic Mandate
                      </h2>
                      <p className="text-[11px] font-mono text-surface-500">
                        Laws with the most votes cast — the platform&rsquo;s most debated proposals
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {data.topByVotes.map((law, i) => {
                      const rankColors = [
                        { text: 'text-gold', bg: 'bg-gold/15' },
                        { text: 'text-surface-300', bg: 'bg-surface-300/20' },
                        { text: 'text-against-400', bg: 'bg-against-500/15' },
                        { text: 'text-surface-500', bg: 'bg-surface-300/10' },
                        { text: 'text-surface-500', bg: 'bg-surface-300/10' },
                      ]
                      const rc = rankColors[i] ?? rankColors[3]
                      return (
                        <LawRow
                          key={law.id}
                          law={law}
                          rank={i + 1}
                          rankColor={rc.text}
                          rankBg={rc.bg}
                        />
                      )
                    })}
                  </div>
                </section>
              )}

              {/* ── Unanimous Victories ──────────────────────────────── */}
              {data.mostUnanimous.length > 0 && (
                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-for-500/10 border border-for-500/30">
                      <ThumbsUp className="h-4 w-4 text-for-400" aria-hidden />
                    </div>
                    <div>
                      <h2 className="font-mono text-base font-bold text-white">
                        Unanimous Victories
                      </h2>
                      <p className="text-[11px] font-mono text-surface-500">
                        Passed with the strongest possible consensus — the Lobby speaks as one
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {data.mostUnanimous.map((law) => (
                      <div
                        key={law.id}
                        className="flex items-start gap-3 p-4 rounded-xl border border-for-500/25 bg-for-500/5 hover:bg-for-500/10 transition-colors group"
                      >
                        <Link href={`/law/${law.id}`} className="flex-1 flex items-start gap-3 min-w-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-mono text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
                              {law.statement}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              {law.category && (
                                <span className={cn('flex items-center gap-1 text-[11px] font-mono font-semibold', catMeta(law.category).color)}>
                                  {law.category}
                                </span>
                              )}
                              <span className="text-[11px] font-mono text-surface-500">
                                {relDate(law.established_at)}
                              </span>
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right space-y-1">
                            <p className="text-sm font-mono font-bold text-for-300">
                              {fmtPct(law.blue_pct)} FOR
                            </p>
                            <p className="text-[11px] font-mono text-surface-500">
                              {fmtVotes(law.total_votes)} votes
                            </p>
                          </div>
                        </Link>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Hard-Won Laws ────────────────────────────────────── */}
              {data.mostContested.length > 0 && (
                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-against-500/10 border border-against-500/30">
                      <Scale className="h-4 w-4 text-against-400" aria-hidden />
                    </div>
                    <div>
                      <h2 className="font-mono text-base font-bold text-white">
                        Hard-Won Laws
                      </h2>
                      <p className="text-[11px] font-mono text-surface-500">
                        Passed with the narrowest consensus — every vote made a difference
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {data.mostContested.map((law) => (
                      <div
                        key={law.id}
                        className="flex items-start gap-3 p-4 rounded-xl border border-against-500/25 bg-against-500/5 hover:bg-against-500/10 transition-colors group"
                      >
                        <Link href={`/law/${law.id}`} className="flex-1 flex items-start gap-3 min-w-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-mono text-white leading-snug line-clamp-2 group-hover:text-against-300 transition-colors">
                              {law.statement}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              {law.category && (
                                <span className={cn('flex items-center gap-1 text-[11px] font-mono font-semibold', catMeta(law.category).color)}>
                                  {law.category}
                                </span>
                              )}
                              <span className="text-[11px] font-mono text-surface-500">
                                {relDate(law.established_at)}
                              </span>
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right space-y-1">
                            <p className="text-sm font-mono font-bold text-against-300">
                              {fmtPct(law.blue_pct)} FOR
                            </p>
                            <p className="text-[11px] font-mono text-surface-500">
                              {fmtVotes(law.total_votes)} votes
                            </p>
                          </div>
                        </Link>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Category Champions ───────────────────────────────── */}
              {categoryChampionEntries.length > 0 && (
                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-purple/10 border border-purple/30">
                      <Award className="h-4 w-4 text-purple" aria-hidden />
                    </div>
                    <div>
                      <h2 className="font-mono text-base font-bold text-white">
                        Category Champions
                      </h2>
                      <p className="text-[11px] font-mono text-surface-500">
                        The most voted law in each of the 10 civic categories
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {categoryChampionEntries.map(([cat, law]) => {
                      const meta = catMeta(cat)
                      const CatIcon = meta.icon
                      return (
                        <Link
                          key={cat}
                          href={`/law/${law.id}`}
                          className={cn(
                            'flex flex-col gap-2 p-3.5 rounded-xl border transition-all group',
                            meta.border,
                            meta.bg,
                            'hover:brightness-110'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <CatIcon className={cn('h-4 w-4 flex-shrink-0', meta.color)} aria-hidden />
                            <span className={cn('text-[11px] font-mono font-bold uppercase tracking-wider', meta.color)}>
                              {cat}
                            </span>
                          </div>
                          <p className="text-xs font-mono text-white line-clamp-2 group-hover:text-surface-300 transition-colors leading-snug">
                            {law.statement}
                          </p>
                          <p className="text-[10px] font-mono text-surface-500">
                            {fmtVotes(law.total_votes)} votes · {fmtPct(law.blue_pct)} FOR
                          </p>
                        </Link>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* ── Top Contributors ─────────────────────────────────── */}
              {data.topContributors.length > 0 && (
                <section>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald/10 border border-emerald/30">
                      <Crown className="h-4 w-4 text-emerald" aria-hidden />
                    </div>
                    <div>
                      <h2 className="font-mono text-base font-bold text-white">
                        Top Contributors
                      </h2>
                      <p className="text-[11px] font-mono text-surface-500">
                        Citizens with the highest civic reputation scores
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {data.topContributors.map((c, i) => (
                      <ContributorRow key={c.id} contributor={c} rank={i + 1} />
                    ))}
                  </div>

                  <div className="mt-4 text-center">
                    <Link
                      href="/leaderboard/reputation"
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                    >
                      Full Reputation Leaderboard
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </div>
                </section>
              )}

              {/* ── Quick Links ──────────────────────────────────────── */}
              <section className="border-t border-surface-300/40 pt-6">
                <p className="text-[11px] font-mono text-surface-600 uppercase tracking-wider mb-3 text-center">
                  Explore More
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { href: '/arguments/hall-of-fame', label: 'Arguments HOF', icon: MessageSquare, color: 'text-purple' },
                    { href: '/leaderboard/legends', label: 'Hall of Legends', icon: Crown, color: 'text-gold' },
                    { href: '/law/ratings', label: 'Law Ratings', icon: Star, color: 'text-gold' },
                    { href: '/law/quality', label: 'Law Quality', icon: Award, color: 'text-emerald' },
                    { href: '/podium', label: 'Weekly Podium', icon: Trophy, color: 'text-for-400' },
                    { href: '/reputation', label: 'Reputation System', icon: Users, color: 'text-emerald' },
                  ].map((link) => {
                    const LinkIcon = link.icon
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="flex items-center gap-2 p-3 rounded-xl border border-surface-300/40 bg-surface-100/40 hover:bg-surface-200/60 hover:border-surface-400/60 transition-colors"
                      >
                        <LinkIcon className={cn('h-3.5 w-3.5 flex-shrink-0', link.color)} aria-hidden />
                        <span className="text-[11px] font-mono text-surface-400 hover:text-white transition-colors truncate">
                          {link.label}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
