'use client'

/**
 * /analytics/opposition — Opposition Intel
 *
 * Shows the strongest arguments written AGAINST your positions — who challenges
 * you, in which categories you face the most organised resistance, and which
 * topics have been most fiercely contested.
 *
 * Distinct from:
 *   /analytics/kin          — finds users who vote alike / opposite (vote-level)
 *   /analytics/contrarian   — how often YOU go against the majority
 *   /analytics/drift        — how consensus has moved away from your votes
 *   /analytics/lens         — your divergence from community consensus
 *
 * This page focuses on ARGUMENT-LEVEL opposition — who is writing the
 * best cases against the positions you hold.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  ExternalLink,
  Flame,
  MessageSquare,
  RefreshCw,
  Scale,
  Shield,
  Swords,
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
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  OppositionResponse,
  OpposingUser,
  OpposingArg,
  CategoryOpposition,
} from '@/app/api/analytics/opposition/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-gold',
}

const ROLE_COLOR: Record<string, string> = {
  elder: 'text-gold',
  troll_catcher: 'text-emerald',
  debator: 'text-for-400',
  person: 'text-surface-500',
}
const ROLE_LABEL: Record<string, string> = {
  elder: 'Elder',
  troll_catcher: 'Troll Catcher',
  debator: 'Debator',
  person: 'Citizen',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBox({
  label,
  value,
  sub,
  icon: Icon,
  color,
  delay = 0,
}: {
  label: string
  value: number | string
  sub: string
  icon: typeof Swords
  color: string
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">{label}</span>
        <Icon className={cn('h-4 w-4', color)} />
      </div>
      <div className="flex items-end gap-1">
        {typeof value === 'number' ? (
          <AnimatedNumber value={value} className={cn('text-2xl font-mono font-bold', color)} />
        ) : (
          <span className={cn('text-2xl font-mono font-bold', color)}>{value}</span>
        )}
      </div>
      <p className="text-[11px] font-mono text-surface-500">{sub}</p>
    </motion.div>
  )
}

function OpponentCard({
  user,
  rank,
  delay = 0,
}: {
  user: OpposingUser
  rank: number
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
      className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-against-500/40 transition-colors"
    >
      <span className={cn(
        'flex-shrink-0 w-5 text-xs font-mono text-center font-bold',
        rank === 1 ? 'text-against-400' : rank === 2 ? 'text-against-500' : 'text-surface-600'
      )}>
        {rank <= 3 ? ['①','②','③'][rank - 1] : rank}
      </span>

      <Link href={`/profile/${user.username}`} className="flex items-center gap-2.5 flex-1 min-w-0 group">
        <Avatar src={user.avatar_url} fallback={user.display_name ?? user.username} size="sm" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-medium text-white group-hover:text-for-300 transition-colors truncate">
              {user.display_name ?? user.username}
            </span>
            {user.role !== 'person' && (
              <span className={cn('text-[10px] font-mono flex-shrink-0', ROLE_COLOR[user.role])}>
                {ROLE_LABEL[user.role]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono text-surface-500">
            <span className="text-against-400 font-semibold">{user.opposing_count} arguments</span>
            {user.top_category && (
              <span className={cn('truncate', CATEGORY_COLOR[user.top_category] ?? 'text-surface-500')}>
                {user.top_category}
              </span>
            )}
          </div>
        </div>
      </Link>

      <div className="flex items-center gap-1 text-xs font-mono text-surface-500 flex-shrink-0">
        <ThumbsUp className="h-3 w-3" />
        <span>{user.total_upvotes}</span>
      </div>

      <Link
        href={`/compare-users?a=me&b=${user.username}`}
        className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono font-semibold bg-surface-200 border border-surface-300 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
        title="Compare stances"
      >
        <Scale className="h-3 w-3" />
        Compare
      </Link>
    </motion.div>
  )
}

function OpposingArgCard({ arg, delay = 0 }: { arg: OpposingArg; delay?: number }) {
  const isFor = arg.side === 'blue'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={cn(
        'rounded-xl border p-4',
        isFor
          ? 'bg-for-600/5 border-for-500/20 hover:border-for-500/35'
          : 'bg-against-600/5 border-against-500/20 hover:border-against-500/35',
        'transition-colors'
      )}
    >
      {/* Author row */}
      <div className="flex items-center gap-2.5 mb-3">
        <Link href={`/profile/${arg.author_username}`} className="flex items-center gap-2 group flex-1 min-w-0">
          <Avatar src={arg.author_avatar_url} fallback={arg.author_display_name ?? arg.author_username} size="xs" />
          <span className="text-xs font-semibold text-white group-hover:text-for-300 transition-colors truncate">
            {arg.author_display_name ?? arg.author_username}
          </span>
        </Link>
        <span className={cn(
          'flex-shrink-0 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full',
          isFor
            ? 'bg-for-500/15 text-for-400'
            : 'bg-against-500/15 text-against-400'
        )}>
          {isFor ? 'FOR' : 'AGAINST'}
        </span>
        <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500 flex-shrink-0">
          <ThumbsUp className="h-3 w-3" />
          <span>{arg.upvotes}</span>
        </div>
      </div>

      {/* Content */}
      <p className="text-sm text-surface-200 leading-relaxed mb-3 line-clamp-3">
        {arg.content}
      </p>

      {/* Topic link */}
      <div className="flex items-start gap-2">
        <Link
          href={`/topic/${arg.topic_id}`}
          className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors flex-1 min-w-0"
        >
          <ExternalLink className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{arg.topic_statement}</span>
        </Link>
        {arg.topic_category && (
          <span className={cn('text-[10px] font-mono flex-shrink-0', CATEGORY_COLOR[arg.topic_category] ?? 'text-surface-500')}>
            {arg.topic_category}
          </span>
        )}
      </div>
    </motion.div>
  )
}

function CategoryBar({ cat, maxArgs }: { cat: CategoryOpposition; maxArgs: number }) {
  const pct = maxArgs > 0 ? (cat.opposing_args / maxArgs) * 100 : 0
  const colorClass = CATEGORY_COLOR[cat.category] ?? 'text-surface-500'
  const barColor =
    cat.category === 'Politics' ? 'bg-for-500' :
    cat.category === 'Economics' ? 'bg-gold' :
    cat.category === 'Technology' ? 'bg-purple' :
    cat.category === 'Science' ? 'bg-emerald' :
    'bg-against-500'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className={cn('font-semibold', colorClass)}>{cat.category}</span>
        <div className="flex items-center gap-3 text-surface-500">
          <span>{cat.opposing_args} args</span>
          <span>{cat.topics_opposed} topic{cat.topics_opposed !== 1 ? 's' : ''}</span>
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" />{cat.avg_upvotes} avg
          </span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={cn('h-full rounded-full', barColor)}
        />
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function OppositionSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-7 w-12 mb-1" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
          <Skeleton className="h-4 w-32 mb-4" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 mb-3">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1"><Skeleton className="h-3 w-24 mb-1" /><Skeleton className="h-2.5 w-16" /></div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
          <Skeleton className="h-4 w-32 mb-4" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-surface-200 p-3 mb-3">
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OppositionPage() {
  const router = useRouter()
  const [data, setData] = useState<OppositionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/opposition')
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json() as OppositionResponse)
    } catch {
      setError('Could not load opposition data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Redirect unauthenticated users
  useEffect(() => {
    if (!loading && data && !data.authenticated) {
      router.push('/login')
    }
  }, [loading, data, router])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 py-8 pb-28 md:pb-12">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/analytics"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to Analytics"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
            <Swords className="h-5 w-5 text-against-400" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white">Opposition Intel</h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              Who argues against you — and how well do they do it?
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Loading state ───────────────────────────────────────────── */}
        {loading && <OppositionSkeleton />}

        {/* ── Error state ─────────────────────────────────────────────── */}
        {!loading && error && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
            <p className="text-against-400 font-mono text-sm mb-3">{error}</p>
            <button
              onClick={load}
              className="px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-white text-sm font-mono hover:bg-surface-300 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Empty state — no votes yet ─────────────────────────────── */}
        {!loading && !error && data && data.total_votes === 0 && (
          <EmptyState
            icon={Swords}
            title="No votes yet"
            description="Cast some votes to start seeing who argues against your positions."
            action={{ label: 'Start voting', href: '/' }}
          />
        )}

        {/* ── Empty state — no opposing args ─────────────────────────── */}
        {!loading && !error && data && data.total_votes > 0 && data.total_opposing_args === 0 && (
          <EmptyState
            icon={Shield}
            title="No opposition yet"
            description="Nobody has written arguments against your positions yet. The field is yours."
            action={{ label: 'Browse debates', href: '/' }}
          />
        )}

        {/* ── Main content ────────────────────────────────────────────── */}
        {!loading && !error && data && data.total_opposing_args > 0 && (
          <div className="space-y-6">

            {/* Stat boxes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatBox
                label="Opposing Args"
                value={data.total_opposing_args}
                sub="written against your positions"
                icon={MessageSquare}
                color="text-against-400"
                delay={0}
              />
              <StatBox
                label="Topics Contested"
                value={data.topics_with_opposition}
                sub={`of ${data.total_votes} you voted on`}
                icon={Scale}
                color="text-purple"
                delay={0.05}
              />
              <StatBox
                label="Avg Upvotes"
                value={data.avg_opposing_upvotes}
                sub="per opposing argument"
                icon={ThumbsUp}
                color="text-gold"
                delay={0.1}
              />
              <StatBox
                label="Adversaries"
                value={data.top_opponents.length}
                sub="active opponents found"
                icon={Users}
                color="text-for-400"
                delay={0.15}
              />
            </div>

            {/* Hardest-fought topic banner */}
            {data.hardest_fought_topic && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.2 }}
                className="rounded-2xl bg-against-500/8 border border-against-500/25 p-4"
              >
                <div className="flex items-center gap-2 text-[11px] font-mono text-against-400 uppercase tracking-wider mb-2">
                  <Flame className="h-3.5 w-3.5" />
                  Hardest fought position
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/topic/${data.hardest_fought_topic.id}`}
                      className="text-base font-semibold text-white hover:text-for-300 transition-colors leading-snug block"
                    >
                      {data.hardest_fought_topic.statement}
                    </Link>
                    <div className="flex items-center gap-3 mt-1.5 text-xs font-mono text-surface-500">
                      {data.hardest_fought_topic.category && (
                        <span className={CATEGORY_COLOR[data.hardest_fought_topic.category] ?? 'text-surface-500'}>
                          {data.hardest_fought_topic.category}
                        </span>
                      )}
                      <span className={data.hardest_fought_topic.user_side === 'blue' ? 'text-for-400' : 'text-against-400'}>
                        You voted {data.hardest_fought_topic.user_side === 'blue' ? 'FOR' : 'AGAINST'}
                      </span>
                      <span>{data.hardest_fought_topic.opposing_arg_count} opposing arguments</span>
                    </div>
                  </div>
                  <Link
                    href={`/topic/${data.hardest_fought_topic.id}`}
                    className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
                  >
                    View <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </motion.div>
            )}

            {/* Two-column layout: opponents + top args */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Top opponents */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.25 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Swords className="h-4 w-4 text-against-400" />
                  <h2 className="text-sm font-mono font-semibold text-white">Top Adversaries</h2>
                  <span className="ml-auto text-[11px] font-mono text-surface-500">by args × upvotes</span>
                </div>

                {data.top_opponents.length === 0 ? (
                  <p className="text-sm font-mono text-surface-500 text-center py-6">No adversaries found yet.</p>
                ) : (
                  <div className="space-y-2">
                    {data.top_opponents.map((user, i) => (
                      <OpponentCard key={user.id} user={user} rank={i + 1} delay={0.05 * i} />
                    ))}
                  </div>
                )}
              </motion.div>

              {/* Top opposing arguments */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.3 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="h-4 w-4 text-gold" />
                  <h2 className="text-sm font-mono font-semibold text-white">Strongest Opposition</h2>
                  <span className="ml-auto text-[11px] font-mono text-surface-500">by upvotes</span>
                </div>

                {data.top_opposing_args.length === 0 ? (
                  <p className="text-sm font-mono text-surface-500 text-center py-6">No high-upvote opposition yet.</p>
                ) : (
                  <div className="space-y-3">
                    {data.top_opposing_args.slice(0, 5).map((arg, i) => (
                      <OpposingArgCard key={arg.id} arg={arg} delay={0.05 * i} />
                    ))}
                    {data.top_opposing_args.length > 5 && (
                      <p className="text-center text-xs font-mono text-surface-500 pt-1">
                        +{data.top_opposing_args.length - 5} more opposing arguments
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            </div>

            {/* Category breakdown */}
            {data.category_breakdown.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.35 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <div className="flex items-center gap-2 mb-5">
                  <BarChart2 className="h-4 w-4 text-purple" />
                  <h2 className="text-sm font-mono font-semibold text-white">Opposition by Category</h2>
                </div>
                <div className="space-y-4">
                  {data.category_breakdown.map((cat) => (
                    <CategoryBar
                      key={cat.category}
                      cat={cat}
                      maxArgs={data.category_breakdown[0]?.opposing_args ?? 1}
                    />
                  ))}
                </div>

                {/* Top opposing arg per heaviest-opposition category */}
                {data.category_breakdown[0]?.top_arg_content && (
                  <div className="mt-5 pt-5 border-t border-surface-300">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 mb-2">
                      <Zap className="h-3 w-3" />
                      Strongest argument in {data.category_breakdown[0].category}
                    </div>
                    <p className="text-sm text-surface-300 leading-relaxed line-clamp-4">
                      &ldquo;{data.category_breakdown[0].top_arg_content}&rdquo;
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Footer navigation */}
            <div className="flex items-center justify-between pt-2 border-t border-surface-300">
              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href="/analytics/kin"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <Users className="h-3.5 w-3.5" />
                  Civic Kin
                </Link>
                <Link
                  href="/analytics/contrarian"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Contrarian
                </Link>
                <Link
                  href="/analytics/drift"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <Scale className="h-3.5 w-3.5" />
                  Drift
                </Link>
              </div>
              <Link
                href="/analytics"
                className="inline-flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                All Analytics <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
