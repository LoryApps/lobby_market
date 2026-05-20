'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  Brain,
  Crown,
  MessageSquare,
  RefreshCw,
  Star,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trophy,
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
import type {
  TopicLeaderboardResponse,
  LeaderboardArguer,
  LeaderboardPredictor,
  LeaderboardOverall,
} from '@/app/api/topics/[id]/leaderboard/route'

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabId = 'voices' | 'oracles' | 'overall'

const TABS: { id: TabId; label: string; icon: typeof Trophy }[] = [
  { id: 'overall',  label: 'Overall',  icon: Trophy   },
  { id: 'voices',   label: 'Voices',   icon: MessageSquare },
  { id: 'oracles',  label: 'Oracles',  icon: Brain    },
]

// ─── Rank medal helper ────────────────────────────────────────────────────────

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-4 w-4 text-gold flex-shrink-0" />
  if (rank === 2) return <Star  className="h-4 w-4 text-surface-400 flex-shrink-0" />
  if (rank === 3) return <Award className="h-4 w-4 text-amber-700 flex-shrink-0" />
  return (
    <span className="text-xs font-mono text-surface-500 w-4 text-center flex-shrink-0">
      {rank}
    </span>
  )
}

// ─── AI grade badge ───────────────────────────────────────────────────────────

function GradeBadge({ grade }: { grade: string }) {
  const colors: Record<string, string> = {
    A: 'bg-emerald/20 text-emerald border-emerald/30',
    B: 'bg-for-500/20 text-for-300 border-for-500/30',
    C: 'bg-gold/20 text-gold border-gold/30',
    D: 'bg-against-500/20 text-against-300 border-against-500/30',
    F: 'bg-against-600/20 text-against-400 border-against-600/30',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center h-5 w-5 rounded text-[10px] font-bold border',
        colors[grade] ?? 'bg-surface-300 text-surface-500 border-surface-400'
      )}
      title={`Best AI quality grade: ${grade}`}
    >
      {grade}
    </span>
  )
}

// ─── Side pill ────────────────────────────────────────────────────────────────

function SidePill({ side }: { side: 'for' | 'against' | 'mixed' }) {
  if (side === 'for') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-for-400 bg-for-500/10 border border-for-500/20 px-1.5 py-0.5 rounded-full">
        <ThumbsUp className="h-2.5 w-2.5" /> For
      </span>
    )
  }
  if (side === 'against') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-against-400 bg-against-500/10 border border-against-500/20 px-1.5 py-0.5 rounded-full">
        <ThumbsDown className="h-2.5 w-2.5" /> Against
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-500 bg-surface-300/20 border border-surface-400/20 px-1.5 py-0.5 rounded-full">
      Both
    </span>
  )
}

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, { variant: 'person' | 'debator' | 'troll_catcher' | 'elder'; label: string }> = {
  debator:       { variant: 'debator',       label: 'Debator'    },
  troll_catcher: { variant: 'troll_catcher', label: 'Moderator'  },
  elder:         { variant: 'elder',         label: 'Elder'      },
}

// ─── Arguer row ───────────────────────────────────────────────────────────────

function ArguerRow({ arguer }: { arguer: LeaderboardArguer }) {
  const roleInfo = ROLE_BADGE[arguer.role]
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link
        href={`/profile/${arguer.username}`}
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-xl transition-all',
          'border border-transparent hover:border-surface-400/30 hover:bg-surface-200/40',
          arguer.rank <= 3 && 'bg-surface-200/20'
        )}
      >
        <RankMedal rank={arguer.rank} />

        <Avatar
          src={arguer.avatar_url}
          fallback={arguer.display_name ?? arguer.username}
          size="sm"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white truncate">
              {arguer.display_name ?? arguer.username}
            </span>
            {roleInfo && (
              <Badge variant={roleInfo.variant} className="text-[10px]">
                {roleInfo.label}
              </Badge>
            )}
            <SidePill side={arguer.dominant_side} />
            {arguer.best_ai_grade && (
              <GradeBadge grade={arguer.best_ai_grade} />
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-surface-500">
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {arguer.argument_count} arg{arguer.argument_count !== 1 ? 's' : ''}
            </span>
            {arguer.reply_count > 0 && (
              <span>{arguer.reply_count} repl{arguer.reply_count !== 1 ? 'ies' : 'y'}</span>
            )}
            {arguer.avg_ai_score != null && (
              <span className="text-purple">
                avg score {arguer.avg_ai_score}/10
              </span>
            )}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="text-sm font-mono font-semibold text-white">
            {arguer.total_upvotes.toLocaleString()}
          </div>
          <div className="text-[10px] text-surface-500">upvotes</div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Predictor row ────────────────────────────────────────────────────────────

function PredictorRow({ predictor }: { predictor: LeaderboardPredictor }) {
  const roleInfo = ROLE_BADGE[predictor.role]
  const resolved = predictor.resolved_at != null
  const correct = predictor.correct

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link
        href={`/profile/${predictor.username}`}
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-xl transition-all',
          'border border-transparent hover:border-surface-400/30 hover:bg-surface-200/40',
          predictor.rank <= 3 && 'bg-surface-200/20'
        )}
      >
        <RankMedal rank={predictor.rank} />

        <Avatar
          src={predictor.avatar_url}
          fallback={predictor.display_name ?? predictor.username}
          size="sm"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white truncate">
              {predictor.display_name ?? predictor.username}
            </span>
            {roleInfo && (
              <Badge variant={roleInfo.variant} className="text-[10px]">
                {roleInfo.label}
              </Badge>
            )}
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full border',
                predictor.predicted_law
                  ? 'text-emerald bg-emerald/10 border-emerald/20'
                  : 'text-against-400 bg-against-500/10 border-against-500/20'
              )}
            >
              {predictor.predicted_law ? 'Law' : 'Fail'}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-surface-500">
            <span>
              {predictor.confidence}% confident
            </span>
            {resolved && (
              <span className={cn(
                'font-medium',
                correct ? 'text-emerald' : 'text-against-400'
              )}>
                {correct ? '✓ Correct' : '✗ Wrong'}
              </span>
            )}
            {!resolved && (
              <span className="text-gold">Pending resolution</span>
            )}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="text-sm font-mono font-semibold text-white">
            {predictor.reputation_score.toLocaleString()}
          </div>
          <div className="text-[10px] text-surface-500">rep score</div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Overall row ──────────────────────────────────────────────────────────────

function OverallRow({ entry }: { entry: LeaderboardOverall }) {
  const roleInfo = ROLE_BADGE[entry.role]
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link
        href={`/profile/${entry.username}`}
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-xl transition-all',
          'border border-transparent hover:border-surface-400/30 hover:bg-surface-200/40',
          entry.rank <= 3 && 'bg-surface-200/20'
        )}
      >
        <RankMedal rank={entry.rank} />

        <Avatar
          src={entry.avatar_url}
          fallback={entry.display_name ?? entry.username}
          size="sm"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white truncate">
              {entry.display_name ?? entry.username}
            </span>
            {roleInfo && (
              <Badge variant={roleInfo.variant} className="text-[10px]">
                {roleInfo.label}
              </Badge>
            )}
            {entry.argument_count > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-purple bg-purple/10 border border-purple/20 px-1.5 py-0.5 rounded-full">
                <MessageSquare className="h-2.5 w-2.5" />
                #{entry.argument_rank}
              </span>
            )}
            {entry.prediction_correct === true && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald bg-emerald/10 border border-emerald/20 px-1.5 py-0.5 rounded-full">
                <Brain className="h-2.5 w-2.5" />
                Oracle ✓
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-surface-500">
            {entry.argument_count > 0 && (
              <span>{entry.argument_count} arg{entry.argument_count !== 1 ? 's' : ''} · {entry.total_upvotes.toLocaleString()} upvotes</span>
            )}
            {entry.prediction_correct === null && entry.predictor_rank != null && (
              <span className="text-gold">Prediction pending</span>
            )}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="text-sm font-mono font-semibold text-gold">
            {entry.impact_score.toLocaleString()}
          </div>
          <div className="text-[10px] text-surface-500">impact</div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LeaderboardSkeleton() {
  return (
    <div className="space-y-2 px-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-2.5 w-20" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-2.5 w-12" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LeaderboardClient() {
  const params = useParams<{ id: string }>()
  const topicId = params.id

  const [data, setData]     = useState<TopicLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  const [tab, setTab]       = useState<TabId>('overall')
  const [refreshing, setRefreshing] = useState(false)

  async function load(showRefreshing = false) {
    if (showRefreshing) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/leaderboard`)
      if (!res.ok) throw new Error('Failed to load leaderboard')
      const json = await res.json() as TopicLeaderboardResponse
      setData(json)
    } catch {
      setError('Could not load the leaderboard. Try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId])

  const topic = data?.topic

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pb-24 pt-4">
        {/* Back link */}
        <div className="mb-4">
          <Link
            href={`/topic/${topicId}`}
            className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to topic
          </Link>
        </div>

        {/* Header */}
        <div className="mb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-gold flex-shrink-0" />
              <h1 className="text-xl font-bold text-white">Topic Leaderboard</h1>
            </div>
            <button
              onClick={() => load(true)}
              disabled={refreshing || loading}
              aria-label="Refresh leaderboard"
              className={cn(
                'p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200',
                'transition-colors disabled:opacity-40'
              )}
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>

          {topic && (
            <p className="mt-1.5 text-sm text-surface-500 line-clamp-2">
              {topic.statement}
            </p>
          )}

          {data && (
            <div className="flex items-center gap-4 mt-3 text-xs font-mono text-surface-500">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {data.totals.total_arguers} debaters
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {data.totals.total_arguments} arguments
              </span>
              <span className="flex items-center gap-1">
                <Target className="h-3 w-3" />
                {data.totals.total_predictors} predictors
              </span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Leaderboard categories"
          className="flex gap-1 mb-4 bg-surface-100 rounded-xl p-1 border border-surface-300"
        >
          {TABS.map((t) => {
            const Icon = t.icon
            const isActive = tab === t.id
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${t.id}`}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-medium transition-all',
                  isActive
                    ? 'bg-surface-200 text-white shadow-sm'
                    : 'text-surface-500 hover:text-surface-400'
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        {loading ? (
          <LeaderboardSkeleton />
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
            <p className="text-surface-500 text-sm">{error}</p>
            <button
              onClick={() => load()}
              className="mt-3 text-sm text-for-400 hover:text-for-300 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              id={`panel-${tab}`}
              role="tabpanel"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {/* Overall tab */}
              {tab === 'overall' && (
                <>
                  {data?.overall.length === 0 ? (
                    <EmptyState
                      icon={Trophy}
                      title="No contributors yet"
                      description="Be the first to write an argument or make a prediction on this topic."
                      actions={[
                        { label: 'Write an argument', href: `/topic/${topicId}/arguments` },
                      ]}
                    />
                  ) : (
                    <div className="space-y-1 bg-surface-100 rounded-2xl border border-surface-300 overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-surface-300/50">
                        <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
                          Impact score = upvotes × 2 + arguments × 5 + correct prediction bonus
                        </p>
                      </div>
                      {data?.overall.map((entry) => (
                        <OverallRow key={entry.user_id} entry={entry} />
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Voices tab */}
              {tab === 'voices' && (
                <>
                  {data?.arguers.length === 0 ? (
                    <EmptyState
                      icon={MessageSquare}
                      title="No arguments yet"
                      description="Write the first argument and claim the top spot."
                      actions={[
                        { label: 'Write an argument', href: `/topic/${topicId}/arguments` },
                      ]}
                    />
                  ) : (
                    <div className="space-y-1 bg-surface-100 rounded-2xl border border-surface-300 overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-surface-300/50">
                        <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
                          Ranked by total upvotes · then argument count
                        </p>
                      </div>
                      {data?.arguers.map((arguer) => (
                        <ArguerRow key={arguer.user_id} arguer={arguer} />
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Oracles tab */}
              {tab === 'oracles' && (
                <>
                  {data?.predictors.length === 0 ? (
                    <EmptyState
                      icon={Brain}
                      title="No predictions yet"
                      description="Make the first prediction on this topic's outcome."
                      actions={[
                        { label: 'Make a prediction', href: `/topic/${topicId}/predictions` },
                      ]}
                    />
                  ) : (
                    <div className="space-y-1 bg-surface-100 rounded-2xl border border-surface-300 overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-surface-300/50">
                        <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
                          Correct predictions first · then confidence level
                        </p>
                      </div>
                      {data?.predictors.map((predictor) => (
                        <PredictorRow key={predictor.user_id} predictor={predictor} />
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Footer links */}
              {data && (data.arguers.length > 0 || data.predictors.length > 0) && (
                <div className="mt-4 flex items-center justify-center gap-4 text-xs text-surface-500">
                  <Link
                    href={`/topic/${topicId}/arguments`}
                    className="flex items-center gap-1 hover:text-white transition-colors"
                  >
                    <Zap className="h-3 w-3" />
                    View all arguments →
                  </Link>
                  <Link
                    href={`/topic/${topicId}/predictions`}
                    className="flex items-center gap-1 hover:text-white transition-colors"
                  >
                    <BarChart2 className="h-3 w-3" />
                    Predictions market →
                  </Link>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
