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
  Heart,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { AllyProfile, CohortResponse } from '@/app/api/users/cohort/route'

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

// ─── Bond ring ────────────────────────────────────────────────────────────────

function BondRing({ bondScore }: { bondScore: number }) {
  const r = 20
  const circumference = 2 * Math.PI * r
  const filled = (bondScore / 100) * circumference
  const color =
    bondScore >= 90 ? '#10b981' : // emerald-500 — kindred spirit
    bondScore >= 80 ? '#34d399' : // emerald-400 — civic twin
    bondScore >= 70 ? '#6ee7b7' : // emerald-300 — strong ally
                     '#a7f3d0'   // emerald-200 — fellow traveller

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
        aria-label={`${bondScore}% alignment`}
      >
        {bondScore}%
      </span>
    </div>
  )
}

// ─── Bond level label ─────────────────────────────────────────────────────────

function BondLevel({ bond }: { bond: number }) {
  if (bond >= 92) return <span className="text-[10px] font-mono font-semibold text-emerald">Kindred spirit</span>
  if (bond >= 85) return <span className="text-[10px] font-mono font-semibold text-emerald">Civic twin</span>
  if (bond >= 75) return <span className="text-[10px] font-mono font-semibold text-for-300">Strong ally</span>
  return <span className="text-[10px] font-mono font-semibold text-gold">Fellow traveller</span>
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function AllySkeleton() {
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

// ─── Ally card ────────────────────────────────────────────────────────────────

function AllyCard({
  ally,
  myUsername,
  rank,
}: {
  ally: AllyProfile
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
      <div className="rounded-2xl border border-surface-300/40 bg-surface-100 hover:border-emerald/30 transition-colors group">
        {/* Main row */}
        <div className="flex items-center gap-3 p-4">
          {/* Bond ring */}
          <BondRing bondScore={ally.bond_score} />

          {/* Profile info */}
          <Link
            href={`/profile/${ally.username}`}
            className="flex items-center gap-3 flex-1 min-w-0"
          >
            <Avatar
              src={ally.avatar_url}
              fallback={ally.display_name || ally.username}
              size="md"
              className="flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="font-semibold text-white text-sm truncate">
                  {ally.display_name || ally.username}
                </span>
                <Badge variant={ROLE_BADGE[ally.role] ?? 'person'} className="text-[10px] px-1.5 py-0">
                  {ROLE_LABEL[ally.role] ?? ally.role}
                </Badge>
              </div>
              <p className="text-[11px] font-mono text-surface-500 mb-1">
                @{ally.username}
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <BondLevel bond={ally.bond_score} />
                <span className="text-[10px] font-mono text-surface-600">
                  {ally.shared_votes} shared votes
                </span>
                <span className="text-[10px] font-mono text-surface-600">
                  {ally.agree_count} agreed · {ally.disagree_count} differed
                </span>
              </div>
            </div>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href={`/compare-users?a=${encodeURIComponent(myUsername)}&b=${encodeURIComponent(ally.username)}`}
              className={cn(
                'hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl',
                'text-xs font-mono font-semibold',
                'bg-emerald/10 border border-emerald/30 text-emerald',
                'hover:bg-emerald/20 transition-colors'
              )}
            >
              <GitCompare className="h-3 w-3" />
              Compare
            </Link>

            {ally.bond_topics.length > 0 && (
              <button
                onClick={() => setExpanded((e) => !e)}
                aria-expanded={expanded}
                aria-label="Toggle bond topics"
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 rounded-xl',
                  'text-xs font-mono font-semibold border transition-colors',
                  expanded
                    ? 'bg-surface-200 border-surface-400 text-surface-500'
                    : 'bg-surface-200/60 border-surface-300 text-surface-500 hover:border-surface-400'
                )}
              >
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                <span className="hidden sm:inline">Topics</span>
              </button>
            )}
          </div>
        </div>

        {/* Bond topics panel */}
        <AnimatePresence>
          {expanded && ally.bond_topics.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="border-t border-surface-300/40 px-4 pb-4 pt-3 space-y-2">
                <p className="text-[10px] font-mono font-semibold text-emerald uppercase tracking-wider mb-2">
                  Shared positions
                </p>
                {ally.bond_topics.map((bt) => (
                  <Link
                    key={bt.topic_id}
                    href={`/topic/${bt.topic_id}`}
                    className="flex items-start gap-3 group/fp hover:bg-surface-200/50 rounded-xl p-2 -mx-2 transition-colors"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {bt.shared_side === 'blue' ? (
                        <ThumbsUp className="h-3.5 w-3.5 text-for-400" aria-label="Both voted For" />
                      ) : (
                        <ThumbsDown className="h-3.5 w-3.5 text-against-400" aria-label="Both voted Against" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/80 line-clamp-2 leading-snug group-hover/fp:text-white transition-colors">
                        {bt.statement}
                      </p>
                      {bt.category && (
                        <span className={cn('text-[10px] font-mono', CATEGORY_COLORS[bt.category] ?? 'text-surface-500')}>
                          {bt.category}
                        </span>
                      )}
                    </div>
                    <ExternalLink className="h-3 w-3 text-surface-600 flex-shrink-0 opacity-0 group-hover/fp:opacity-100 mt-0.5 transition-opacity" />
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CohortClient() {
  const [data, setData] = useState<CohortResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/users/cohort')
      if (!res.ok) {
        if (res.status === 401) {
          setError('Sign in to discover your civic tribe.')
        } else {
          setError('Could not load your tribe. Please try again.')
        }
        return
      }
      const json = await res.json() as CohortResponse
      setData(json)
    } catch {
      setError('Could not load your tribe. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-5 w-5 text-emerald" />
                <h1 className="text-xl font-bold text-white">Civic Tribe</h1>
              </div>
              <p className="text-sm text-surface-500">
                Citizens who vote most like you — your civic allies.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/rivals"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-surface-200/60 border border-surface-300 text-surface-400 hover:border-against-500/40 hover:text-against-400 transition-colors"
              >
                <ArrowRight className="h-3 w-3" />
                Rivals
              </Link>
              <button
                onClick={load}
                disabled={loading}
                aria-label="Refresh"
                className="p-2 rounded-xl bg-surface-200/60 border border-surface-300 text-surface-400 hover:border-surface-400 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </button>
            </div>
          </div>

          {/* Stats strip */}
          {data && (
            <div className="flex items-center gap-4 mb-6 px-4 py-3 rounded-2xl bg-surface-100 border border-surface-300/40">
              <div className="text-center flex-1">
                <p className="text-lg font-bold font-mono text-white">{data.my_total_votes}</p>
                <p className="text-[11px] text-surface-500">Your votes</p>
              </div>
              <div className="h-8 w-px bg-surface-300/40" />
              <div className="text-center flex-1">
                <p className="text-lg font-bold font-mono text-emerald">{data.allies.length}</p>
                <p className="text-[11px] text-surface-500">Civic allies</p>
              </div>
              <div className="h-8 w-px bg-surface-300/40" />
              <div className="text-center flex-1">
                <p className="text-lg font-bold font-mono text-gold">
                  {data.allies.length > 0
                    ? Math.round(data.allies.reduce((s, a) => s + a.bond_score, 0) / data.allies.length)
                    : 0}%
                </p>
                <p className="text-[11px] text-surface-500">Avg alignment</p>
              </div>
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <AllySkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <EmptyState
              icon={Users}
              title="Not available"
              description={error}
              actions={
                error.includes('Sign in')
                  ? [{ label: 'Sign in', href: '/login', icon: ArrowRight }]
                  : [{ label: 'Try again', onClick: load, icon: RefreshCw, variant: 'secondary' as const }]
              }
            />
          ) : !data || data.allies.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No tribe yet"
              description={
                (data?.my_total_votes ?? 0) < 3
                  ? 'Vote on at least 3 topics to find your civic allies.'
                  : 'No citizens have voted the same way on enough shared topics yet. Keep voting to find your tribe.'
              }
              actions={
                (data?.my_total_votes ?? 0) < 3
                  ? [{ label: 'Go vote', href: '/', icon: ArrowRight }]
                  : undefined
              }
            />
          ) : (
            <>
              {/* Top ally spotlight */}
              {data.allies[0] && (
                <div className="mb-4 px-4 py-3 rounded-2xl bg-emerald/5 border border-emerald/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Heart className="h-3.5 w-3.5 text-emerald" />
                    <span className="text-[11px] font-mono font-semibold text-emerald uppercase tracking-wider">
                      Top ally — {data.allies[0].bond_score}% aligned
                    </span>
                  </div>
                  <p className="text-xs text-surface-400 leading-relaxed">
                    <span className="text-white font-semibold">
                      {data.allies[0].display_name || data.allies[0].username}
                    </span>{' '}
                    agrees with you on{' '}
                    <span className="text-emerald font-semibold">{data.allies[0].agree_count}</span> of{' '}
                    {data.allies[0].shared_votes} shared debates.
                    {data.allies[0].top_shared_category && (
                      <> You align most on{' '}
                        <span className={cn('font-semibold', CATEGORY_COLORS[data.allies[0].top_shared_category] ?? 'text-surface-400')}>
                          {data.allies[0].top_shared_category}
                        </span>.
                      </>
                    )}
                  </p>
                </div>
              )}

              {/* Ally list */}
              <div className="space-y-3">
                {data.allies.map((ally, i) => (
                  <AllyCard
                    key={ally.id}
                    ally={ally}
                    myUsername={data.my_username}
                    rank={i}
                  />
                ))}
              </div>

              {/* Footer note */}
              <p className="mt-6 text-center text-[11px] font-mono text-surface-600">
                Based on your {data.my_total_votes} most recent votes.{' '}
                <span className="text-surface-500">Minimum 60% shared agreement · at least 3 common debates.</span>
              </p>
            </>
          )}

          {/* Cross-link to rivals */}
          <div className="mt-8 flex items-center gap-3 p-4 rounded-2xl bg-surface-100 border border-surface-300/40 hover:border-against-500/30 transition-colors group">
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Your Civic Rivals</p>
              <p className="text-xs text-surface-500 mt-0.5">See who votes opposite to you on the platform.</p>
            </div>
            <Link
              href="/rivals"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-semibold bg-against-500/10 border border-against-500/30 text-against-400 hover:bg-against-500/20 transition-colors"
            >
              View rivals
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Leaderboard link */}
          <div className="mt-3 flex items-center gap-3 p-4 rounded-2xl bg-surface-100 border border-surface-300/40 hover:border-for-500/30 transition-colors">
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Civic Leaderboard</p>
              <p className="text-xs text-surface-500 mt-0.5">How do you rank among all citizens?</p>
            </div>
            <Link
              href="/leaderboard"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-semibold bg-for-500/10 border border-for-500/30 text-for-400 hover:bg-for-500/20 transition-colors"
            >
              Leaderboard
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

        </div>
      </main>
      <BottomNav />
    </div>
  )
}
