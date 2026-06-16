'use client'

/**
 * /leaderboard/depth — The Civic Depth League
 *
 * Ranks citizens by the QUALITY of their civic engagement rather than
 * volume.  A composite "depth score" blends four dimensions:
 *
 *   Argument Quality  (40%) — average AI-graded score of their arguments,
 *                             weighted by upvotes received
 *   Citation Rate     (20%) — proportion of arguments backed by sources
 *   Evidence Submissions (20%) — external evidence added to debates
 *   Wiki Contributions   (20%) — edits made to topic wiki sections
 *
 * Tiers:
 *   Scholar    (≥ 80) — platinum-tier civic intellectuals
 *   Analyst    (≥ 40) — gold-tier researchers and writers
 *   Researcher (≥ 15) — silver-tier engaged contributors
 *   Seeker      (< 15) — building depth through practice
 *
 * Distinct from:
 *   /leaderboard/arguments  — volume of arguments, not quality
 *   /leaderboard/grades     — raw AI grade counts
 *   /leaderboard/evidence   — evidence volume only
 *   /leaderboard/wiki       — wiki edits only
 *
 * This is the only leaderboard that synthesises all four quality signals
 * into a single holistic ranking.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BookOpen,
  Brain,
  ChevronRight,
  Crown,
  ExternalLink,
  FileText,
  GraduationCap,
  Info,
  Link2,
  RefreshCw,
  Sparkles,
  Star,
  Trophy,
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
  DepthLeaderEntry,
  DepthMyStats,
  DepthTier,
  DepthLeaderboardResponse,
} from '@/app/api/leaderboard/depth/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<DepthTier, {
  label: string
  color: string
  bg: string
  border: string
  badge: string
  icon: React.ComponentType<{ className?: string }>
}> = {
  scholar: {
    label: 'Scholar',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    badge: 'bg-purple/20 text-purple border-purple/30',
    icon: GraduationCap,
  },
  analyst: {
    label: 'Analyst',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    badge: 'bg-gold/20 text-gold border-gold/30',
    icon: Brain,
  },
  researcher: {
    label: 'Researcher',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    badge: 'bg-for-500/20 text-for-400 border-for-500/30',
    icon: BookOpen,
  },
  seeker: {
    label: 'Seeker',
    color: 'text-surface-500',
    bg: 'bg-surface-300/20',
    border: 'border-surface-400/30',
    badge: 'bg-surface-300/30 text-surface-500 border-surface-400/30',
    icon: Sparkles,
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatScore(score: number) {
  return score.toFixed(1)
}

function gradeColor(avg: number): string {
  if (avg >= 8.5) return 'text-gold'
  if (avg >= 7)   return 'text-emerald'
  if (avg >= 5)   return 'text-for-400'
  if (avg >= 3)   return 'text-surface-500'
  return 'text-against-400'
}

// ─── Mini bar component ───────────────────────────────────────────────────────

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex-1 h-1.5 rounded-full bg-surface-300/60 overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(pct, 100)}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={cn('h-full rounded-full', color)}
      />
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-6 rounded" />
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── My Stats Banner ─────────────────────────────────────────────────────────

function MyStatsBanner({ stats }: { stats: DepthMyStats }) {
  const tier = TIER_CONFIG[stats.tier]
  const TierIcon = tier.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-4 mb-6',
        tier.bg, tier.border,
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg', tier.bg, tier.border, 'border')}>
          <TierIcon className={cn('h-4 w-4', tier.color)} />
        </div>
        <div>
          <p className="text-xs font-mono text-surface-500">Your Depth Rank</p>
          <p className={cn('text-sm font-bold font-mono', tier.color)}>
            {stats.rank ? `#${stats.rank}` : 'Unranked'} · {tier.label}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Score</p>
          <p className="text-xl font-bold font-mono text-white">{stats.depth_score}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          {
            label: 'Avg Grade',
            value: stats.scored_args > 0 ? formatScore(stats.avg_ai_score) : '—',
            icon: Brain,
            color: stats.avg_ai_score > 0 ? gradeColor(stats.avg_ai_score) : 'text-surface-500',
          },
          {
            label: 'Citation %',
            value: `${stats.citation_rate}%`,
            icon: Link2,
            color: 'text-emerald',
          },
          {
            label: 'Evidence',
            value: String(stats.evidence_count),
            icon: FileText,
            color: 'text-for-400',
          },
          {
            label: 'Wiki Edits',
            value: String(stats.wiki_edits),
            icon: BookOpen,
            color: 'text-purple',
          },
        ].map((m) => {
          const MIcon = m.icon
          return (
            <div key={m.label} className="rounded-xl bg-surface-200/50 border border-surface-300/60 p-2.5 text-center">
              <MIcon className={cn('h-3 w-3 mx-auto mb-1', m.color)} />
              <p className={cn('text-sm font-bold font-mono', m.color)}>{m.value}</p>
              <p className="text-[10px] font-mono text-surface-600 leading-tight mt-0.5">{m.label}</p>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ─── Entry row ────────────────────────────────────────────────────────────────

function EntryRow({ entry, rank }: { entry: DepthLeaderEntry; rank: number }) {
  const tier = TIER_CONFIG[entry.tier]
  const TierIcon = tier.icon
  const [expanded, setExpanded] = useState(false)

  const isTop3 = rank <= 3
  const medalColor = rank === 1 ? 'text-gold' : rank === 2 ? 'text-surface-400' : 'text-amber-700'

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(rank * 0.02, 0.3) }}
      className={cn(
        'rounded-2xl border transition-colors',
        expanded
          ? cn(tier.bg, tier.border)
          : 'bg-surface-100 border-surface-300 hover:border-surface-400',
      )}
    >
      {/* Main row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-3 sm:p-4 text-left"
        aria-expanded={expanded}
      >
        {/* Rank */}
        <div className="flex-shrink-0 w-7 text-center">
          {isTop3 ? (
            <Crown className={cn('h-4 w-4 mx-auto', medalColor)} />
          ) : (
            <span className="text-xs font-mono text-surface-500">#{rank}</span>
          )}
        </div>

        {/* Avatar */}
        <Link
          href={`/profile/${entry.username}`}
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0"
          aria-label={`View ${entry.display_name ?? entry.username}'s profile`}
        >
          <Avatar
            src={entry.avatar_url}
            fallback={entry.display_name ?? entry.username}
            size="sm"
          />
        </Link>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              href={`/profile/${entry.username}`}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-semibold text-white hover:text-for-300 transition-colors truncate"
            >
              {entry.display_name ?? entry.username}
            </Link>
            <span className={cn(
              'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border',
              tier.badge,
            )}>
              <TierIcon className="h-2.5 w-2.5" />
              {tier.label}
            </span>
          </div>
          <p className="text-xs text-surface-500 font-mono truncate">@{entry.username}</p>
        </div>

        {/* Score */}
        <div className="flex-shrink-0 text-right">
          <p className={cn('text-lg font-bold font-mono', tier.color)}>
            <AnimatedNumber value={entry.depth_score} />
          </p>
          <p className="text-[10px] font-mono text-surface-600">depth</p>
        </div>
      </button>

      {/* Expanded metrics */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-2.5 border-t border-surface-300/50">
              {/* Argument quality */}
              <div className="flex items-center gap-2">
                <Brain className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
                <span className="text-xs text-surface-500 w-28 flex-shrink-0">Avg AI Score</span>
                <MiniBar
                  pct={(entry.avg_ai_score / 10) * 100}
                  color={entry.avg_ai_score >= 7 ? 'bg-gold' : entry.avg_ai_score >= 5 ? 'bg-for-500' : 'bg-surface-400'}
                />
                <span className={cn('text-xs font-mono font-semibold w-10 text-right flex-shrink-0', gradeColor(entry.avg_ai_score))}>
                  {entry.scored_args > 0 ? formatScore(entry.avg_ai_score) : '—'}
                </span>
              </div>

              {/* Citation rate */}
              <div className="flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
                <span className="text-xs text-surface-500 w-28 flex-shrink-0">Citation Rate</span>
                <MiniBar pct={entry.citation_rate} color="bg-emerald" />
                <span className="text-xs font-mono font-semibold text-emerald w-10 text-right flex-shrink-0">
                  {entry.citation_rate}%
                </span>
              </div>

              {/* Evidence */}
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
                <span className="text-xs text-surface-500 w-28 flex-shrink-0">Evidence Filed</span>
                <MiniBar pct={(entry.evidence_count / 15) * 100} color="bg-for-500" />
                <span className="text-xs font-mono font-semibold text-for-400 w-10 text-right flex-shrink-0">
                  {entry.evidence_count}
                </span>
              </div>

              {/* Wiki edits */}
              <div className="flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
                <span className="text-xs text-surface-500 w-28 flex-shrink-0">Wiki Edits</span>
                <MiniBar pct={(entry.wiki_edits / 20) * 100} color="bg-purple" />
                <span className="text-xs font-mono font-semibold text-purple w-10 text-right flex-shrink-0">
                  {entry.wiki_edits}
                </span>
              </div>

              {/* Profile link */}
              <Link
                href={`/profile/${entry.username}`}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors pt-1"
              >
                <ExternalLink className="h-3 w-3" />
                View full profile
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DepthLeaderboardPage() {
  const [data, setData] = useState<DepthLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/leaderboard/depth', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as DepthLeaderboardResponse
      setData(json)
    } catch {
      setError('Could not load the Depth League. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <Link
            href="/leaderboard"
            className="flex items-center justify-center h-11 w-11 rounded-xl bg-surface-100 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors flex-shrink-0 mt-0.5"
            aria-label="Back to leaderboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="h-5 w-5 text-purple flex-shrink-0" />
              <h1 className="text-xl font-bold font-mono text-white">Civic Depth League</h1>
            </div>
            <p className="text-sm text-surface-500 leading-snug">
              Quality over quantity — ranked by argument calibre, citations, evidence, and wiki contributions.
            </p>
          </div>

          <div className="flex gap-2 flex-shrink-0 mt-0.5">
            <button
              onClick={() => setInfoOpen((v) => !v)}
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-100 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
              aria-label="How scoring works"
            >
              <Info className="h-4 w-4" />
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-100 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Scoring explainer */}
        <AnimatePresence>
          {infoOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
                <p className="text-xs font-mono text-surface-400 uppercase tracking-wider font-semibold">
                  How Depth Score is calculated
                </p>
                {[
                  {
                    label: 'Argument Quality',
                    weight: '40%',
                    desc: 'Average AI-graded score of your arguments, weighted by upvotes received.',
                    color: 'text-gold',
                    icon: Brain,
                  },
                  {
                    label: 'Citation Rate',
                    weight: '20%',
                    desc: 'Proportion of your arguments backed by an external source URL.',
                    color: 'text-emerald',
                    icon: Link2,
                  },
                  {
                    label: 'Evidence Submissions',
                    weight: '20%',
                    desc: 'Number of external evidence items you have added to debates (capped at 15).',
                    color: 'text-for-400',
                    icon: FileText,
                  },
                  {
                    label: 'Wiki Contributions',
                    weight: '20%',
                    desc: 'Number of topic wiki edits you have made (capped at 20).',
                    color: 'text-purple',
                    icon: BookOpen,
                  },
                ].map(({ label, weight, desc, color, icon: Icon }) => (
                  <div key={label} className="flex gap-3">
                    <Icon className={cn('h-4 w-4 flex-shrink-0 mt-0.5', color)} />
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {label}
                        <span className={cn('ml-2 text-xs font-mono', color)}>{weight}</span>
                      </p>
                      <p className="text-xs text-surface-500 leading-snug">{desc}</p>
                    </div>
                  </div>
                ))}
                <div className="pt-1 border-t border-surface-300 flex items-center gap-2 text-xs text-surface-500">
                  <Award className="h-3.5 w-3.5 flex-shrink-0" />
                  Tiers: Scholar (≥ 80) · Analyst (≥ 40) · Researcher (≥ 15) · Seeker (0+)
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Platform stats bar */}
        {data && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-3 gap-3 mb-6"
          >
            {[
              {
                label: 'Ranked Citizens',
                value: data.total_participants,
                icon: Trophy,
                color: 'text-purple',
              },
              {
                label: 'Scored Arguments',
                value: data.platform_scored_args,
                icon: Star,
                color: 'text-gold',
              },
              {
                label: 'Platform Avg',
                value: data.platform_avg_score.toFixed(1),
                icon: Zap,
                color: 'text-emerald',
                isString: true,
              },
            ].map(({ label, value, icon: Icon, color, isString }) => (
              <div
                key={label}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-3 text-center"
              >
                <Icon className={cn('h-4 w-4 mx-auto mb-1.5', color)} />
                <p className={cn('text-lg font-bold font-mono', color)}>
                  {isString ? String(value) : <AnimatedNumber value={value as number} />}
                </p>
                <p className="text-[10px] font-mono text-surface-500 leading-tight">{label}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* My stats */}
        {data?.my_stats && !loading && (
          <MyStatsBanner stats={data.my_stats} />
        )}

        {/* Tier legend */}
        {!loading && data && data.entries.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {(Object.entries(TIER_CONFIG) as [DepthTier, typeof TIER_CONFIG[DepthTier]][]).map(([key, cfg]) => {
              const TierIcon = cfg.icon
              const count = data.entries.filter((e) => e.tier === key).length
              if (count === 0) return null
              return (
                <span
                  key={key}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono border',
                    cfg.badge,
                  )}
                >
                  <TierIcon className="h-3 w-3" />
                  {cfg.label} · {count}
                </span>
              )
            })}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <PageSkeleton />
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-against-400 text-sm mb-3">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm text-white hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </button>
          </div>
        ) : !data || data.entries.length === 0 ? (
          <EmptyState
            icon={<GraduationCap className="h-8 w-8 text-surface-500" />}
            title="No scholars yet"
            description="The Depth League fills as citizens get their arguments AI-graded, add citations, submit evidence, and contribute to topic wikis."
            action={
              <Link
                href="/arguments"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-semibold hover:bg-for-500 transition-colors"
              >
                Post an argument <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {data.entries.map((entry) => (
              <EntryRow key={entry.user_id} entry={entry} rank={entry.rank} />
            ))}

            {/* Footer note */}
            <div className="pt-4 text-center text-xs font-mono text-surface-600 space-y-1">
              <p>Showing top {data.entries.length} citizens · {data.total_participants.toLocaleString()} total ranked</p>
              <div className="flex items-center justify-center gap-3 pt-1">
                <Link href="/leaderboard" className="hover:text-surface-400 transition-colors">All Leaderboards</Link>
                <span className="text-surface-700">·</span>
                <Link href="/arguments/top-scored" className="hover:text-surface-400 transition-colors">Top Scored Arguments</Link>
                <span className="text-surface-700">·</span>
                <Link href="/leaderboard/wiki" className="hover:text-surface-400 transition-colors">Wiki Leaders</Link>
              </div>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
