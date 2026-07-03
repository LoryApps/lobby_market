'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BookOpen,
  Check,
  ChevronRight,
  Crown,
  HelpCircle,
  MessageSquare,
  RefreshCw,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { QALeader, OpenQuestion, QALeadersResponse } from '@/app/api/questions/leaders/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const STATUS_COLOR: Record<string, string> = {
  proposed: 'text-surface-500 border-surface-500/40 bg-surface-500/10',
  active:   'text-for-400 border-for-500/40 bg-for-500/10',
  voting:   'text-purple border-purple/40 bg-purple/10',
  law:      'text-gold border-gold/40 bg-gold/10',
  failed:   'text-against-400 border-against-500/40 bg-against-500/10',
}

const RANK_STYLES = [
  { crown: 'text-gold', bg: 'bg-gold/10 border-gold/30', num: 'text-gold' },
  { crown: 'text-surface-400', bg: 'bg-surface-300/20 border-surface-400/30', num: 'text-surface-400' },
  { crown: 'text-amber-600', bg: 'bg-amber-900/20 border-amber-700/30', num: 'text-amber-600' },
]

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = 'questioners' | 'answerers' | 'open'

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  icon: Icon,
  value,
  label,
  color = 'text-surface-400',
}: {
  icon: typeof ThumbsUp
  value: number | string
  label: string
  color?: string
}) {
  return (
    <div className="flex items-center gap-1 text-xs font-mono">
      <Icon className={cn('h-3 w-3 flex-shrink-0', color)} />
      <span className="text-white font-medium">{value}</span>
      <span className="text-surface-500">{label}</span>
    </div>
  )
}

// ─── Questioner card ─────────────────────────────────────────────────────────

function QuestionerCard({ leader, rank }: { leader: QALeader; rank: number }) {
  const style = RANK_STYLES[rank - 1]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04 }}
      className={cn(
        'relative flex items-center gap-3 p-4 rounded-2xl border transition-colors',
        rank <= 3
          ? cn('bg-surface-200 border-surface-300', style?.bg)
          : 'bg-surface-100 border-surface-300 hover:border-surface-400'
      )}
    >
      {/* Rank */}
      <div
        className={cn(
          'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-mono font-bold',
          rank <= 3
            ? cn('border', style?.bg, style?.num)
            : 'text-surface-500'
        )}
      >
        {rank <= 3 ? (
          <Crown className={cn('h-3.5 w-3.5', style?.crown)} />
        ) : (
          <span>{rank}</span>
        )}
      </div>

      {/* Avatar */}
      <Link href={`/profile/${leader.username}`} className="flex-shrink-0">
        <Avatar
          src={leader.avatar_url}
          username={leader.username}
          size="sm"
          role={leader.role as 'person' | 'debator' | 'troll_catcher' | 'elder' | undefined}
        />
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${leader.username}`}
          className="font-semibold text-white text-sm hover:text-for-400 transition-colors truncate block"
        >
          {leader.display_name || leader.username}
        </Link>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <StatPill
            icon={HelpCircle}
            value={leader.question_count}
            label={leader.question_count === 1 ? 'question' : 'questions'}
            color="text-for-400"
          />
          <StatPill
            icon={ThumbsUp}
            value={leader.total_question_upvotes}
            label="upvotes"
            color="text-emerald"
          />
        </div>
      </div>

      {/* Clout badge */}
      <div className="flex-shrink-0 text-right">
        <div className="flex items-center gap-1 text-xs font-mono text-gold">
          <Zap className="h-3 w-3" />
          <span className="font-semibold">{leader.clout.toLocaleString()}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Answerer card ────────────────────────────────────────────────────────────

function AnswererCard({ leader, rank }: { leader: QALeader; rank: number }) {
  const style = RANK_STYLES[rank - 1]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04 }}
      className={cn(
        'relative flex items-center gap-3 p-4 rounded-2xl border transition-colors',
        rank <= 3
          ? cn('bg-surface-200 border-surface-300', style?.bg)
          : 'bg-surface-100 border-surface-300 hover:border-surface-400'
      )}
    >
      {/* Rank */}
      <div
        className={cn(
          'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-mono font-bold',
          rank <= 3
            ? cn('border', style?.bg, style?.num)
            : 'text-surface-500'
        )}
      >
        {rank <= 3 ? (
          <Crown className={cn('h-3.5 w-3.5', style?.crown)} />
        ) : (
          <span>{rank}</span>
        )}
      </div>

      {/* Avatar */}
      <Link href={`/profile/${leader.username}`} className="flex-shrink-0">
        <Avatar
          src={leader.avatar_url}
          username={leader.username}
          size="sm"
          role={leader.role as 'person' | 'debator' | 'troll_catcher' | 'elder' | undefined}
        />
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${leader.username}`}
          className="font-semibold text-white text-sm hover:text-for-400 transition-colors truncate block"
        >
          {leader.display_name || leader.username}
        </Link>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <StatPill
            icon={Check}
            value={leader.accepted_count}
            label={leader.accepted_count === 1 ? 'accepted' : 'accepted'}
            color="text-emerald"
          />
          <StatPill
            icon={MessageSquare}
            value={leader.answer_count}
            label={leader.answer_count === 1 ? 'answer' : 'answers'}
            color="text-purple"
          />
          <StatPill
            icon={ThumbsUp}
            value={leader.total_answer_upvotes}
            label="upvotes"
            color="text-for-400"
          />
        </div>
      </div>

      {/* Acceptance rate */}
      {leader.answer_count > 0 && (
        <div className="flex-shrink-0 text-right">
          <div className="text-xs font-mono text-emerald font-semibold">
            {Math.round((leader.accepted_count / leader.answer_count) * 100)}%
          </div>
          <div className="text-[10px] font-mono text-surface-500 mt-0.5">accepted</div>
        </div>
      )}
    </motion.div>
  )
}

// ─── Open question card ───────────────────────────────────────────────────────

function OpenQuestionCard({ question, rank }: { question: OpenQuestion; rank: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04 }}
    >
      <Link
        href={`/topic/${question.topic_id}/ask`}
        className={cn(
          'flex gap-3 p-4 rounded-2xl border bg-surface-100 border-surface-300',
          'hover:border-surface-400 hover:bg-surface-200 transition-colors group'
        )}
      >
        {/* Upvote count */}
        <div className="flex-shrink-0 flex flex-col items-center gap-0.5 pt-0.5">
          <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
          <span className="text-xs font-mono font-bold text-for-400">
            {question.upvotes}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white leading-snug group-hover:text-for-300 transition-colors line-clamp-2">
            {question.content}
          </p>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {/* Topic pill */}
            {question.topic && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border',
                  STATUS_COLOR[question.topic.status] ?? STATUS_COLOR.proposed
                )}
              >
                {question.topic.statement.slice(0, 40)}
                {question.topic.statement.length > 40 ? '…' : ''}
              </span>
            )}

            {/* Category */}
            {question.topic?.category && (
              <span className="text-[10px] font-mono text-surface-500">
                {question.topic.category}
              </span>
            )}

            {/* Age */}
            <span className="text-[10px] font-mono text-surface-500 ml-auto">
              {relativeTime(question.created_at)}
            </span>
          </div>

          {/* Answers so far */}
          {question.answer_count > 0 && (
            <div className="flex items-center gap-1 mt-1.5 text-[10px] font-mono text-surface-500">
              <MessageSquare className="h-3 w-3" />
              {question.answer_count} partial {question.answer_count === 1 ? 'answer' : 'answers'} — no accepted solution yet
            </div>
          )}
        </div>

        <ChevronRight className="h-4 w-4 text-surface-600 flex-shrink-0 self-center group-hover:text-surface-400 transition-colors" />
      </Link>
    </motion.div>
  )
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function LeaderSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-4 rounded-2xl bg-surface-100 border border-surface-300 animate-pulse"
        >
          <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
          <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-4 w-12 flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}

// ─── Stats banner ─────────────────────────────────────────────────────────────

function StatsBanner({
  stats,
}: {
  stats: QALeadersResponse['stats']
}) {
  const answerRate =
    stats.total_questions > 0
      ? Math.round((stats.answered_questions / stats.total_questions) * 100)
      : 0

  const items = [
    { icon: HelpCircle, value: stats.total_questions.toLocaleString(), label: 'Questions' },
    { icon: MessageSquare, value: stats.total_answers.toLocaleString(), label: 'Answers' },
    { icon: Check, value: `${answerRate}%`, label: 'Answered' },
    { icon: Users, value: stats.unique_questioners.toLocaleString(), label: 'Questioners' },
    { icon: BookOpen, value: stats.unique_answerers.toLocaleString(), label: 'Answerers' },
  ]

  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
      {items.map(({ icon: Icon, value, label }) => (
        <div
          key={label}
          className="flex flex-col items-center gap-1 p-3 rounded-xl bg-surface-100 border border-surface-300 text-center"
        >
          <Icon className="h-4 w-4 text-for-400" />
          <p className="text-base font-mono font-bold text-white">{value}</p>
          <p className="text-[10px] font-mono text-surface-500">{label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function LeadersClient() {
  const [data, setData] = useState<QALeadersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('answerers')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/questions/leaders', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Could not load leaderboard. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const TABS: { id: Tab; label: string; icon: typeof Trophy }[] = [
    { id: 'answerers',   label: 'Top Answerers',   icon: Award   },
    { id: 'questioners', label: 'Top Questioners',  icon: HelpCircle },
    { id: 'open',        label: 'Open Questions',   icon: Zap     },
  ]

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-4 pb-24 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <div className="flex items-center gap-3">
            <Link
              href="/questions"
              className="flex-shrink-0 flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Q&A Hub
            </Link>
          </div>

          <div className="flex items-start justify-between gap-3 pt-1">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Trophy className="h-6 w-6 text-gold" />
                Knowledge Leaders
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-1">
                The citizens keeping the Lobby informed — top question-askers and answer-givers.
              </p>
            </div>
            <button
              onClick={() => load(true)}
              disabled={loading || refreshing}
              className={cn(
                'flex-shrink-0 p-2 rounded-xl border border-surface-300 text-surface-500',
                'hover:text-white hover:border-surface-400 transition-colors',
                refreshing && 'animate-spin'
              )}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </motion.div>

        {/* Stats */}
        {data && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <StatsBanner stats={data.stats} />
          </motion.div>
        )}

        {/* Tab bar */}
        <div className="flex items-center gap-1 bg-surface-200/70 border border-surface-300 rounded-xl p-1 backdrop-blur-sm">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg',
                'text-xs font-mono font-semibold transition-all duration-150',
                tab === id
                  ? 'bg-for-600 text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-300'
              )}
            >
              <Icon className="h-3 w-3 flex-shrink-0" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label.split(' ')[1] ?? label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <LeaderSkeleton count={8} />
        ) : error ? (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/10 p-6 text-center">
            <p className="text-sm font-mono text-against-400">{error}</p>
            <button
              onClick={() => load()}
              className="mt-3 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-white hover:bg-surface-300 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {tab === 'questioners' && (
              <motion.div
                key="questioners"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="space-y-3"
              >
                {(data?.topQuestioners ?? []).length === 0 ? (
                  <EmptyState
                    icon={HelpCircle}
                    title="No questioners yet"
                    description="Be the first to ask clarifying questions on topics you care about."
                    actions={[{ label: 'Browse Q&A', href: '/questions' }]}
                    size="sm"
                  />
                ) : (
                  (data?.topQuestioners ?? []).map((leader, i) => (
                    <QuestionerCard key={leader.id} leader={leader} rank={i + 1} />
                  ))
                )}

                {/* CTA */}
                {(data?.topQuestioners ?? []).length > 0 && (
                  <div className="pt-2 text-center">
                    <Link
                      href="/questions"
                      className="inline-flex items-center gap-2 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
                    >
                      Ask a question to climb the rankings
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}
              </motion.div>
            )}

            {tab === 'answerers' && (
              <motion.div
                key="answerers"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="space-y-3"
              >
                {(data?.topAnswerers ?? []).length === 0 ? (
                  <EmptyState
                    icon={MessageSquare}
                    title="No answerers yet"
                    description="Start answering community questions to appear here."
                    actions={[{ label: 'See open questions', href: '#', onClick: () => setTab('open') }]}
                    size="sm"
                  />
                ) : (
                  (data?.topAnswerers ?? []).map((leader, i) => (
                    <AnswererCard key={leader.id} leader={leader} rank={i + 1} />
                  ))
                )}

                {/* Explainer */}
                <div className="rounded-xl bg-surface-200/50 border border-surface-300 p-4 text-xs font-mono text-surface-500 space-y-1">
                  <p className="text-surface-400 font-semibold mb-1">How to rank here:</p>
                  <div className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-emerald flex-shrink-0" />
                    <span>Answer questions — question authors mark accepted answers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="h-3 w-3 text-for-400 flex-shrink-0" />
                    <span>Get upvoted by the community for helpful answers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Award className="h-3 w-3 text-gold flex-shrink-0" />
                    <span>Accepted answers count most toward your ranking</span>
                  </div>
                </div>
              </motion.div>
            )}

            {tab === 'open' && (
              <motion.div
                key="open"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="space-y-3"
              >
                <p className="text-xs font-mono text-surface-500 px-1">
                  The most upvoted questions still waiting for an accepted answer — your expertise could help.
                </p>

                {(data?.openQuestions ?? []).length === 0 ? (
                  <EmptyState
                    icon={Zap}
                    iconColor="text-gold"
                    title="All caught up!"
                    description="Every popular question has been answered. Check back later for new ones."
                    actions={[{ label: 'Browse all questions', href: '/questions' }]}
                    size="sm"
                  />
                ) : (
                  (data?.openQuestions ?? []).map((q, i) => (
                    <OpenQuestionCard key={q.id} question={q} rank={i + 1} />
                  ))
                )}

                {(data?.openQuestions ?? []).length > 0 && (
                  <div className="pt-2 text-center">
                    <Link
                      href="/questions?filter=unanswered"
                      className="inline-flex items-center gap-2 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
                    >
                      See all unanswered questions
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
