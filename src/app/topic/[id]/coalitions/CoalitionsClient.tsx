'use client'

/**
 * /topic/[id]/coalitions — Coalition Political Landscape
 *
 * Shows which organised coalitions have declared a stance on this debate:
 * FOR, AGAINST, or NEUTRAL — weighted by member count and influence score.
 *
 * Distinct from:
 *   /coalitions          — browse all coalitions on the platform
 *   /topic/[id]/voters   — individual citizen vote breakdown
 *   /topic/[id]/impact   — argument-level influence attribution
 *
 * This is the political layer: organised civic blocs and their formal positions.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  Clock,
  Flag,
  RefreshCw,
  Scale,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { CoalitionStanceEntry } from '@/app/api/topics/[id]/coalition-stances/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  topicId: string
  statement: string
  category: string | null
  status: string
  bluePct: number
  totalVotes: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Coalition Stance Card ─────────────────────────────────────────────────────

interface StanceCardProps {
  entry: CoalitionStanceEntry
  index: number
}

function StanceCard({ entry, index }: StanceCardProps) {
  const { coalition, stance, statement, declarer, created_at } = entry

  const stanceConfig = {
    for: {
      label: 'FOR',
      icon: ThumbsUp,
      color: 'text-for-400',
      border: 'border-for-500/30',
      bg: 'bg-for-500/5',
      badgeBg: 'bg-for-500/20 text-for-400',
      bar: 'bg-for-500',
    },
    against: {
      label: 'AGAINST',
      icon: ThumbsDown,
      color: 'text-against-400',
      border: 'border-against-500/30',
      bg: 'bg-against-500/5',
      badgeBg: 'bg-against-500/20 text-against-400',
      bar: 'bg-against-500',
    },
    neutral: {
      label: 'NEUTRAL',
      icon: Scale,
      color: 'text-surface-400',
      border: 'border-surface-400/30',
      bg: 'bg-surface-100',
      badgeBg: 'bg-surface-400/20 text-surface-400',
      bar: 'bg-surface-400',
    },
  }

  const cfg = stanceConfig[stance]
  const Icon = cfg.icon

  const influenceLabel = coalition.coalition_influence >= 1000
    ? `${(coalition.coalition_influence / 1000).toFixed(1)}k`
    : String(coalition.coalition_influence)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'rounded-2xl border p-5 transition-all',
        cfg.border,
        cfg.bg,
      )}
    >
      {/* Coalition header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Coalition badge emoji or default shield */}
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{
              backgroundColor: coalition.color ? `${coalition.color}20` : undefined,
              borderColor: coalition.color ? `${coalition.color}40` : undefined,
            }}
          >
            {coalition.badge_emoji ?? <Shield className="h-5 w-5 text-surface-400" />}
          </div>

          <div className="min-w-0">
            <Link
              href={`/coalitions/${coalition.id}`}
              className="font-mono text-sm font-bold text-white hover:text-for-300 transition-colors truncate block"
            >
              {coalition.name}
            </Link>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex items-center gap-1 text-surface-500">
                <Users className="h-3 w-3" />
                <span className="font-mono text-[10px]">
                  {coalition.member_count.toLocaleString()} members
                </span>
              </div>
              <span className="text-surface-600">·</span>
              <div className="flex items-center gap-1 text-surface-500">
                <Zap className="h-3 w-3" />
                <span className="font-mono text-[10px]">{influenceLabel} influence</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stance badge */}
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-mono font-bold flex-shrink-0', cfg.badgeBg)}>
          <Icon className="h-3 w-3" />
          {cfg.label}
        </span>
      </div>

      {/* Official statement */}
      {statement && (
        <div className="mb-3 pl-1">
          <p className="font-mono text-sm text-surface-300 leading-relaxed italic">
            &ldquo;{statement}&rdquo;
          </p>
        </div>
      )}

      {/* Influence bar */}
      <div className="mb-3">
        <div className="h-1 w-full rounded-full bg-surface-300/30 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', cfg.bar)}
            style={{
              width: `${Math.min(100, Math.max(2, Math.log10(Math.max(1, coalition.coalition_influence)) * 20))}%`,
            }}
          />
        </div>
      </div>

      {/* Footer: declared by + date */}
      <div className="flex items-center justify-between">
        {declarer ? (
          <Link
            href={`/profile/${declarer.username}`}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Avatar
              src={declarer.avatar_url}
              fallback={declarer.display_name ?? declarer.username ?? '?'}
              size="xs"
            />
            <span className="font-mono text-[10px] text-surface-500">
              Declared by{' '}
              <span className="text-surface-400 font-semibold">
                @{declarer.username}
              </span>
            </span>
          </Link>
        ) : (
          <span className="font-mono text-[10px] text-surface-600">No declarer on record</span>
        )}

        <div className="flex items-center gap-1 text-surface-600">
          <Clock className="h-3 w-3" />
          <span className="font-mono text-[10px]">{relativeTime(created_at)}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Landscape Meter ──────────────────────────────────────────────────────────

interface LandscapeMeterProps {
  stances: CoalitionStanceEntry[]
}

function LandscapeMeter({ stances }: LandscapeMeterProps) {
  const forEntries = stances.filter((s) => s.stance === 'for')
  const againstEntries = stances.filter((s) => s.stance === 'against')
  const neutralEntries = stances.filter((s) => s.stance === 'neutral')

  const forWeight = forEntries.reduce((acc, s) => acc + s.coalition.member_count, 0)
  const againstWeight = againstEntries.reduce((acc, s) => acc + s.coalition.member_count, 0)
  const neutralWeight = neutralEntries.reduce((acc, s) => acc + s.coalition.member_count, 0)
  const total = forWeight + againstWeight + neutralWeight || 1

  const forPct = Math.round((forWeight / total) * 100)
  const againstPct = Math.round((againstWeight / total) * 100)
  const neutralPct = 100 - forPct - againstPct

  const totalMembers = forWeight + againstWeight + neutralWeight

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 className="h-4 w-4 text-gold" />
        <span className="font-mono text-xs font-bold uppercase tracking-widest text-gold">
          Coalition Landscape
        </span>
        <span className="ml-auto font-mono text-[10px] text-surface-500">
          {stances.length} coalition{stances.length !== 1 ? 's' : ''} ·{' '}
          {totalMembers.toLocaleString()} members total
        </span>
      </div>

      {/* Segmented bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-px mb-3">
        {forPct > 0 && (
          <div
            className="bg-for-500 transition-all"
            style={{ width: `${forPct}%` }}
          />
        )}
        {neutralPct > 0 && (
          <div
            className="bg-surface-400 transition-all"
            style={{ width: `${neutralPct}%` }}
          />
        )}
        {againstPct > 0 && (
          <div
            className="bg-against-500 transition-all"
            style={{ width: `${againstPct}%` }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-for-500" />
          <span className="font-mono text-xs text-for-400 font-semibold">{forPct}% FOR</span>
          <span className="font-mono text-[10px] text-surface-500">({forEntries.length})</span>
        </div>
        {neutralEntries.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-surface-400" />
            <span className="font-mono text-xs text-surface-400 font-semibold">{neutralPct}% NEUTRAL</span>
            <span className="font-mono text-[10px] text-surface-500">({neutralEntries.length})</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-against-500" />
          <span className="font-mono text-xs text-against-400 font-semibold">{againstPct}% AGAINST</span>
          <span className="font-mono text-[10px] text-surface-500">({againstEntries.length})</span>
        </div>
      </div>

      {/* Context note */}
      <p className="font-mono text-[10px] text-surface-600 mt-3">
        Weighted by coalition member count. Each coalition&apos;s stance represents an official declaration by its leadership.
      </p>
    </motion.div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function CoalitionsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-28 w-full rounded-2xl" />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-36 w-full rounded-2xl" />
      ))}
    </div>
  )
}

// ─── Main Client ──────────────────────────────────────────────────────────────

export function CoalitionsClient({ topicId, statement, category, status, bluePct, totalVotes }: Props) {
  const [stances, setStances] = useState<CoalitionStanceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct

  const fetchStances = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/coalition-stances`)
      if (!res.ok) throw new Error('Failed to load coalition stances')
      const data: { stances: CoalitionStanceEntry[] } = await res.json()
      setStances(data.stances ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { fetchStances() }, [fetchStances])

  // Group stances by position
  const forStances = stances.filter((s) => s.stance === 'for')
  const againstStances = stances.filter((s) => s.stance === 'against')
  const neutralStances = stances.filter((s) => s.stance === 'neutral')

  return (
    <div className="flex flex-col min-h-screen bg-surface-900 text-white">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24">
        {/* Back navigation */}
        <Link
          href={`/topic/${topicId}`}
          className="inline-flex items-center gap-1.5 text-surface-500 hover:text-surface-300 transition-colors mb-5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="font-mono text-xs">Back to debate</span>
        </Link>

        {/* Topic header */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant={STATUS_BADGE[status] ?? 'proposed'}>
              {STATUS_LABEL[status] ?? status}
            </Badge>
            {category && (
              <Badge variant="person">{category}</Badge>
            )}
            <div className="flex items-center gap-1.5 ml-auto">
              <Flag className="h-3.5 w-3.5 text-gold" />
              <span className="font-mono text-xs font-bold text-gold uppercase tracking-widest">
                Coalition Stances
              </span>
            </div>
          </div>

          <h1 className="font-mono text-lg font-bold text-white leading-snug mb-2">
            {statement}
          </h1>

          {/* Community vote summary */}
          <div className="flex items-center gap-2">
            <div className="flex h-1.5 w-24 rounded-full overflow-hidden">
              <div className="bg-for-500" style={{ width: `${forPct}%` }} />
              <div className="bg-against-500" style={{ width: `${againstPct}%` }} />
            </div>
            <span className="font-mono text-[10px] text-surface-500">
              {forPct}% For · {againstPct}% Against ·{' '}
              {(totalVotes ?? 0).toLocaleString()} citizen votes
            </span>
          </div>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CoalitionsLoadingSkeleton />
            </motion.div>
          )}

          {!loading && error && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl bg-against-500/10 border border-against-500/30 p-4 text-center"
            >
              <p className="font-mono text-sm text-against-300 mb-3">{error}</p>
              <button
                onClick={fetchStances}
                className="inline-flex items-center gap-2 font-mono text-xs text-surface-400 hover:text-white transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Try again
              </button>
            </motion.div>
          )}

          {!loading && !error && stances.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-16 text-center gap-4"
            >
              <div className="h-16 w-16 rounded-2xl bg-surface-100 border border-surface-300 flex items-center justify-center">
                <Flag className="h-7 w-7 text-surface-500" />
              </div>
              <div>
                <p className="font-mono text-sm font-semibold text-surface-300 mb-1">
                  No coalition stances yet
                </p>
                <p className="font-mono text-xs text-surface-500 max-w-xs">
                  Coalitions haven&apos;t declared a formal position on this debate.
                  Coalition leaders can stake a stance from their coalition page.
                </p>
              </div>
              <Link
                href="/coalitions"
                className="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl font-mono text-xs font-semibold border border-surface-400 text-surface-300 hover:text-white hover:border-surface-300 transition-all"
              >
                Browse coalitions
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </motion.div>
          )}

          {!loading && !error && stances.length > 0 && (
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Landscape meter */}
              <LandscapeMeter stances={stances} />

              {/* FOR stances */}
              {forStances.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-for-400">
                      Supporting ({forStances.length})
                    </span>
                  </div>
                  <div className="space-y-3">
                    {forStances.map((entry, i) => (
                      <StanceCard key={entry.id} entry={entry} index={i} />
                    ))}
                  </div>
                </div>
              )}

              {/* AGAINST stances */}
              {againstStances.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-against-400">
                      Opposing ({againstStances.length})
                    </span>
                  </div>
                  <div className="space-y-3">
                    {againstStances.map((entry, i) => (
                      <StanceCard key={entry.id} entry={entry} index={i + forStances.length} />
                    ))}
                  </div>
                </div>
              )}

              {/* NEUTRAL stances */}
              {neutralStances.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <Scale className="h-3.5 w-3.5 text-surface-400" />
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-surface-400">
                      Neutral ({neutralStances.length})
                    </span>
                  </div>
                  <div className="space-y-3">
                    {neutralStances.map((entry, i) => (
                      <StanceCard
                        key={entry.id}
                        entry={entry}
                        index={i + forStances.length + againstStances.length}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Refresh */}
              <div className="flex justify-center mt-4">
                <button
                  onClick={fetchStances}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh stances
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation links */}
        {!loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-2 gap-2 mt-6"
          >
            {[
              { href: `/topic/${topicId}/voters`, icon: Users, label: 'Citizen Votes', desc: 'Who voted & why' },
              { href: `/topic/${topicId}/impact`, icon: Zap, label: 'Argument Impact', desc: 'Influential cases' },
              { href: `/topic/${topicId}/momentum`, icon: BarChart2, label: 'Momentum', desc: 'Vote trend over time' },
              { href: `/coalitions`, icon: Shield, label: 'All Coalitions', desc: 'Browse civic blocs' },
            ].map(({ href, icon: Icon, label, desc }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-all"
              >
                <Icon className="h-4 w-4 text-surface-400 flex-shrink-0" />
                <div>
                  <p className="font-mono text-xs font-semibold text-surface-200">{label}</p>
                  <p className="font-mono text-[10px] text-surface-500">{desc}</p>
                </div>
                <ChevronRight className="h-3 w-3 text-surface-600 ml-auto flex-shrink-0" />
              </Link>
            ))}
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
