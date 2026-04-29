'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GitCompare,
  RefreshCw,
  Swords,
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
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { RivalProfile, RivalsResponse } from '@/app/api/users/rivals/route'

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
  lawmaker: 'Lawmaker',
  senator: 'Senator',
}

const ROLE_BADGE: Record<string, 'person' | 'debator' | 'troll_catcher' | 'elder'> = {
  person: 'person',
  debator: 'debator',
  troll_catcher: 'troll_catcher',
  elder: 'elder',
  lawmaker: 'elder',
  senator: 'elder',
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

// ─── Clash ring ───────────────────────────────────────────────────────────────

function ClashRing({ clashScore }: { clashScore: number }) {
  const r = 20
  const circumference = 2 * Math.PI * r
  // Higher clash score = more red fill
  const filled = (clashScore / 100) * circumference
  const color =
    clashScore >= 80 ? '#ef4444' : // red-500 — extreme rival
    clashScore >= 65 ? '#f87171' : // against-400 — strong rival
    clashScore >= 50 ? '#fb923c' : // orange — moderate rival
                       '#f59e0b'   // gold — mild rival

  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 52, height: 52 }}>
      <svg width="52" height="52" className="-rotate-90" aria-hidden="true">
        <circle
          cx="26" cy="26" r={r}
          fill="none"
          stroke="currentColor"
          className="text-surface-300"
          strokeWidth="3"
        />
        <circle
          cx="26" cy="26" r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - filled}
          strokeLinecap="round"
        />
      </svg>
      <span
        className="absolute font-mono font-bold text-[11px] leading-none"
        style={{ color }}
        aria-label={`${clashScore}% clash rate`}
      >
        {clashScore}%
      </span>
    </div>
  )
}

// ─── Rivalry level ────────────────────────────────────────────────────────────

function RivalryLevel({ clash }: { clash: number }) {
  if (clash >= 85) return <span className="text-[10px] font-mono font-semibold text-against-400">Arch nemesis</span>
  if (clash >= 70) return <span className="text-[10px] font-mono font-semibold text-against-300">Fierce rival</span>
  if (clash >= 55) return <span className="text-[10px] font-mono font-semibold text-orange-400">Strong opposition</span>
  return <span className="text-[10px] font-mono font-semibold text-gold">Frequent opponent</span>
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function RivalSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl border border-surface-300/40 bg-surface-100 animate-pulse">
      <div className="flex-shrink-0 h-[52px] w-[52px] rounded-full bg-surface-300/50" />
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="h-10 w-10 rounded-full bg-surface-300/50 flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-8 w-20 rounded-lg flex-shrink-0" />
    </div>
  )
}

// ─── Rival card ───────────────────────────────────────────────────────────────

function RivalCard({
  rival,
  myUsername,
  rank,
}: {
  rival: RivalProfile
  myUsername: string
  rank: number
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04, duration: 0.25 }}
    >
      <div className="rounded-2xl border border-surface-300/40 bg-surface-100 hover:border-against-500/30 transition-colors group">
        {/* Main row */}
        <div className="flex items-center gap-3 p-4">
          {/* Clash ring */}
          <ClashRing clashScore={rival.clash_score} />

          {/* Profile info */}
          <Link
            href={`/profile/${rival.username}`}
            className="flex items-center gap-3 flex-1 min-w-0"
          >
            <Avatar
              src={rival.avatar_url}
              fallback={rival.display_name || rival.username}
              size="md"
              className="flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="font-semibold text-white text-sm truncate">
                  {rival.display_name || rival.username}
                </span>
                <Badge variant={ROLE_BADGE[rival.role] ?? 'person'} className="text-[10px] px-1.5 py-0">
                  {ROLE_LABEL[rival.role] ?? rival.role}
                </Badge>
              </div>
              <p className="text-[11px] font-mono text-surface-500 mb-1">
                @{rival.username}
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <RivalryLevel clash={rival.clash_score} />
                <span className="text-[10px] font-mono text-surface-600">
                  {rival.shared_votes} shared votes
                </span>
                <span className="text-[10px] font-mono text-surface-600">
                  {rival.disagree_count} clashes · {rival.agree_count} agree
                </span>
              </div>
            </div>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Compare CTA */}
            <Link
              href={`/compare-users?a=${encodeURIComponent(myUsername)}&b=${encodeURIComponent(rival.username)}`}
              className={cn(
                'hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl',
                'text-xs font-mono font-semibold',
                'bg-against-600/20 border border-against-600/30 text-against-400',
                'hover:bg-against-600/40 hover:border-against-500/50 transition-all',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-against-500/50'
              )}
              aria-label={`Compare your votes with @${rival.username}`}
            >
              <GitCompare className="h-3.5 w-3.5 flex-shrink-0" />
              Compare
            </Link>

            {/* Expand flashpoints */}
            {rival.flashpoints.length > 0 && (
              <button
                onClick={() => setExpanded((e) => !e)}
                aria-expanded={expanded}
                aria-label={expanded ? 'Hide flashpoint topics' : 'Show flashpoint topics'}
                className={cn(
                  'flex items-center justify-center h-8 w-8 rounded-xl',
                  'text-surface-500 hover:text-against-400 border border-surface-300/40',
                  'hover:border-against-500/30 hover:bg-against-500/10 transition-all',
                  expanded && 'text-against-400 border-against-500/30 bg-against-500/10'
                )}
              >
                {expanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Flashpoints */}
        <AnimatePresence>
          {expanded && rival.flashpoints.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-0 space-y-2 border-t border-surface-300/30 mt-0 pt-3">
                <p className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-wider mb-2">
                  Flashpoint topics — you clashed here
                </p>
                {rival.flashpoints.map((fp) => (
                  <Link
                    key={fp.topic_id}
                    href={`/topic/${fp.topic_id}`}
                    className="flex items-start gap-3 p-3 rounded-xl bg-surface-200/60 hover:bg-surface-200 border border-surface-300/30 hover:border-surface-400/40 transition-colors group/fp"
                  >
                    {/* Vote comparison */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
                      <span
                        className={cn(
                          'flex items-center gap-0.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded',
                          fp.my_side === 'blue'
                            ? 'bg-for-500/20 text-for-400'
                            : 'bg-against-500/20 text-against-400'
                        )}
                      >
                        {fp.my_side === 'blue' ? (
                          <ThumbsUp className="h-2.5 w-2.5" />
                        ) : (
                          <ThumbsDown className="h-2.5 w-2.5" />
                        )}
                        You
                      </span>
                      <span className="text-[9px] text-surface-600 font-mono">vs</span>
                      <span
                        className={cn(
                          'flex items-center gap-0.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded',
                          fp.their_side === 'blue'
                            ? 'bg-for-500/20 text-for-400'
                            : 'bg-against-500/20 text-against-400'
                        )}
                      >
                        {fp.their_side === 'blue' ? (
                          <ThumbsUp className="h-2.5 w-2.5" />
                        ) : (
                          <ThumbsDown className="h-2.5 w-2.5" />
                        )}
                        Them
                      </span>
                    </div>

                    {/* Topic info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white leading-snug line-clamp-2 group-hover/fp:text-for-300 transition-colors">
                        {fp.statement}
                      </p>
                      {fp.category && (
                        <span className={cn('text-[10px] font-mono mt-0.5 block', CATEGORY_COLORS[fp.category] ?? 'text-surface-500')}>
                          {fp.category}
                        </span>
                      )}
                    </div>

                    <ExternalLink className="h-3 w-3 text-surface-600 group-hover/fp:text-surface-400 flex-shrink-0 mt-0.5 transition-colors" />
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─── Sort options ─────────────────────────────────────────────────────────────

type SortMode = 'clash' | 'shared'

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'clash', label: 'Most opposed' },
  { id: 'shared', label: 'Most shared votes' },
]

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RivalsPage() {
  const [data, setData] = useState<RivalsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortMode>('clash')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/users/rivals')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (res.status === 401) {
          setError('Sign in to discover your ideological rivals.')
        } else {
          setError(body.error ?? 'Failed to load rivals.')
        }
        return
      }
      const json = await res.json() as RivalsResponse
      setData(json)
    } catch {
      setError('Unable to connect. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const displayedRivals: RivalProfile[] = data
    ? [...data.rivals].sort((a, b) => {
        if (sort === 'clash') {
          if (a.clash_score !== b.clash_score) return b.clash_score - a.clash_score
          return b.shared_votes - a.shared_votes
        }
        if (a.shared_votes !== b.shared_votes) return b.shared_votes - a.shared_votes
        return b.clash_score - a.clash_score
      })
    : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30">
              <Swords className="h-5 w-5 text-against-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Civic Rivals
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Citizens who voted opposite to you
              </p>
            </div>
          </div>
          <p className="text-sm text-surface-500 leading-relaxed max-w-xl">
            Based on how you both voted on shared topics. High clash score means
            your positions consistently diverge — the mark of a genuine ideological opponent.
            Use the <strong className="text-surface-300">Compare</strong> button to see exactly where your views split.
          </p>
        </div>

        {/* ── Controls ───────────────────────────────────────────────────── */}
        {!loading && data && data.rivals.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {/* Sort toggle */}
            <div className="flex items-center gap-0.5 bg-surface-200/80 border border-surface-300 rounded-lg p-0.5 backdrop-blur-sm">
              {SORT_OPTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setSort(id)}
                  aria-pressed={sort === id}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-all',
                    sort === id
                      ? 'bg-against-600 text-white shadow-sm'
                      : 'text-surface-500 hover:text-surface-300'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Stat summary */}
            <p className="text-[11px] font-mono text-surface-600">
              {displayedRivals.length} rival{displayedRivals.length !== 1 ? 's' : ''} found
            </p>

            {/* Refresh */}
            <button
              onClick={load}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-500 hover:text-white border border-surface-300/40 hover:border-surface-400 transition-all"
              aria-label="Refresh rivals"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          </div>
        )}

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <RivalSkeleton key={i} />
            ))}
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {!loading && error && (
          <EmptyState
            icon={Swords}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/30"
            title="Couldn't load rivals"
            description={error}
            actions={
              error.includes('Sign in')
                ? [{ label: 'Sign in', href: '/login', variant: 'primary' as const, icon: ArrowRight }]
                : [{ label: 'Try again', onClick: load, variant: 'primary' as const, icon: RefreshCw }]
            }
          />
        )}

        {/* ── Empty — not enough votes ──────────────────────────────────── */}
        {!loading && !error && data && data.rivals.length === 0 && (
          <EmptyState
            icon={Swords}
            iconColor="text-surface-500"
            iconBg="bg-surface-300/20"
            iconBorder="border-surface-400/20"
            title="No rivals found yet"
            description={
              data.my_total_votes < 3
                ? `You've cast ${data.my_total_votes} vote${data.my_total_votes === 1 ? '' : 's'}. Cast at least 3 to start finding your ideological opponents.`
                : "No one has voted opposite you on enough shared topics yet. Keep voting and check back as the community grows."
            }
            actions={[{ label: 'Start voting', href: '/', variant: 'primary' as const, icon: Zap }]}
          />
        )}

        {/* ── Results ──────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {!loading && !error && displayedRivals.length > 0 && (
            <motion.div
              key={sort}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              {displayedRivals.map((rival, i) => (
                <RivalCard
                  key={rival.id}
                  rival={rival}
                  myUsername={data!.my_username}
                  rank={i}
                />
              ))}

              {/* Stats footer */}
              <div className="pt-4 text-center space-y-2">
                <p className="text-[11px] font-mono text-surface-600">
                  Based on your {Math.min(data!.my_total_votes, 200).toLocaleString()} most recent votes
                </p>
                <div className="flex items-center justify-center gap-4">
                  <Link
                    href="/twins"
                    className="flex items-center gap-1.5 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
                  >
                    <Users className="h-3 w-3" />
                    Find your Vote Twins
                  </Link>
                  <span className="text-surface-600">·</span>
                  <Link
                    href="/compare-users"
                    className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-surface-300 transition-colors"
                  >
                    <GitCompare className="h-3 w-3" />
                    Compare any two users
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      <BottomNav />
    </div>
  )
}
