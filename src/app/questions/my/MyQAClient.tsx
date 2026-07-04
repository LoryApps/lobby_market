'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HelpCircle,
  MessageSquare,
  Check,
  ThumbsUp,
  Award,
  Zap,
  ArrowRight,
  Lightbulb,
  ChevronRight,
  User,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MyQAResponse, MyQuestion, MyAnswer, OpportunityQuestion } from '@/app/api/questions/my/route'

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

const TIER_STYLE: Record<string, { label: string; className: string }> = {
  sage: {
    label: 'Sage',
    className: 'bg-gold/20 border-gold/40 text-gold',
  },
  expert: {
    label: 'Expert',
    className: 'bg-purple/20 border-purple/40 text-purple',
  },
  contributor: {
    label: 'Contributor',
    className: 'bg-for-500/10 border-for-500/30 text-for-400',
  },
}

const STATUS_COLOR: Record<string, string> = {
  proposed: 'text-surface-500 border-surface-500/40 bg-surface-500/10',
  active:   'text-for-400 border-for-500/40 bg-for-500/10',
  voting:   'text-purple border-purple/40 bg-purple/10',
  law:      'text-emerald border-emerald/40 bg-emerald/10',
  failed:   'text-against-400 border-against-500/40 bg-against-500/10',
}

const TABS = [
  { id: 'questions', label: 'My Questions', icon: HelpCircle },
  { id: 'answers',   label: 'My Answers',   icon: MessageSquare },
  { id: 'expert',    label: 'Expert Picks',  icon: Lightbulb },
] as const

type TabId = (typeof TABS)[number]['id']

// ─── Topic breadcrumb ─────────────────────────────────────────────────────────

function TopicCrumb({
  topic,
}: {
  topic: { id: string; statement: string; category: string | null; status: string } | null
}) {
  if (!topic) return null
  return (
    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
      {topic.category && (
        <span className="text-[10px] font-mono font-semibold text-purple uppercase tracking-widest">
          {topic.category}
        </span>
      )}
      <span className="text-surface-600 text-[10px]">/</span>
      <Link
        href={`/topic/${topic.id}`}
        onClick={(e) => e.stopPropagation()}
        className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors truncate max-w-[260px]"
      >
        {topic.statement.length > 55
          ? `${topic.statement.slice(0, 55)}…`
          : topic.statement}
      </Link>
      <span
        className={cn(
          'text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider flex-shrink-0',
          STATUS_COLOR[topic.status] ?? STATUS_COLOR.proposed
        )}
      >
        {topic.status === 'law' ? 'LAW' : topic.status}
      </span>
    </div>
  )
}

// ─── Question card ────────────────────────────────────────────────────────────

function QuestionCard({ q }: { q: MyQuestion }) {
  return (
    <div className="rounded-2xl border bg-surface-200/60 border-surface-300/60 p-4 hover:border-surface-400/60 transition-colors">
      <TopicCrumb topic={q.topic} />
      <p className="text-sm font-medium text-white leading-relaxed mb-3">{q.content}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono text-surface-600">{relativeTime(q.created_at)}</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <MessageSquare className="h-3 w-3" />
            {q.answer_count}
          </span>
          <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <ThumbsUp className="h-3 w-3" />
            {q.upvotes}
          </span>
          {q.is_answered ? (
            <span className="flex items-center gap-1 text-[11px] font-mono text-emerald">
              <Check className="h-3 w-3" />
              Answered
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <Zap className="h-3 w-3" />
              Open
            </span>
          )}
          <Link
            href={`/questions/${q.id}`}
            className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-for-400 transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Answer card ──────────────────────────────────────────────────────────────

function AnswerCard({ a }: { a: MyAnswer }) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4 transition-colors',
        a.is_accepted
          ? 'bg-emerald/5 border-emerald/25 hover:border-emerald/40'
          : 'bg-surface-200/60 border-surface-300/60 hover:border-surface-400/60'
      )}
    >
      <TopicCrumb topic={a.topic} />

      {/* The question being answered */}
      {a.question && (
        <p className="text-[11px] font-mono text-surface-500 mb-2 italic line-clamp-2">
          Q: {a.question.content}
        </p>
      )}

      {/* Answer content */}
      <div className="flex gap-2 mb-3">
        {a.is_accepted && (
          <div className="flex-shrink-0 mt-0.5 flex items-center justify-center h-4 w-4 rounded-full bg-emerald/20 border border-emerald/40">
            <Check className="h-2.5 w-2.5 text-emerald" />
          </div>
        )}
        <p className="text-sm text-white leading-relaxed">{a.content}</p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono text-surface-600">{relativeTime(a.created_at)}</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <ThumbsUp className="h-3 w-3" />
            {a.upvotes}
          </span>
          {a.is_accepted && (
            <span className="text-[11px] font-mono text-emerald font-semibold">Best Answer</span>
          )}
          {a.question && (
            <Link
              href={`/questions/${a.question_id}`}
              className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-for-400 transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Opportunity card ─────────────────────────────────────────────────────────

function OpportunityCard({ q }: { q: OpportunityQuestion }) {
  return (
    <div className="rounded-2xl border bg-surface-200/60 border-purple/20 hover:border-purple/40 p-4 transition-colors">
      <TopicCrumb topic={q.topic} />
      <p className="text-sm font-medium text-white leading-relaxed mb-3">{q.content}</p>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <ThumbsUp className="h-3 w-3" />
            {q.upvotes}
          </span>
          <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <MessageSquare className="h-3 w-3" />
            {q.answer_count}
          </span>
          <span className="text-[10px] font-mono text-surface-600">{relativeTime(q.created_at)}</span>
        </div>
        <Link
          href={`/questions/${q.id}`}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl',
            'bg-purple/20 border border-purple/40 text-purple text-[11px] font-mono font-semibold',
            'hover:bg-purple/30 transition-colors'
          )}
        >
          <Zap className="h-3 w-3" />
          Answer
        </Link>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MyQAClient() {
  const router = useRouter()
  const [data, setData] = useState<MyQAResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabId>('questions')

  useEffect(() => {
    fetch('/api/questions/my')
      .then(async (res) => {
        if (res.status === 401) {
          router.push('/login')
          return
        }
        if (res.ok) {
          const json = await res.json()
          setData(json as MyQAResponse)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [router])

  const tabCount: Record<TabId, number> = {
    questions: data?.questions.length ?? 0,
    answers:   data?.answers.length ?? 0,
    expert:    data?.opportunities.length ?? 0,
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30">
              <User className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">My Q&amp;A</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Your questions, answers, and expertise
              </p>
            </div>
          </div>
          <Link
            href="/questions"
            className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors text-xs font-mono"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Q&amp;A Hub
          </Link>
        </div>

        {/* Stats strip */}
        {loading ? (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Questions', value: data.stats.questions_asked, icon: HelpCircle, color: 'text-purple' },
              { label: 'Answers',   value: data.stats.answers_given,   icon: MessageSquare, color: 'text-for-400' },
              { label: 'Accepted',  value: data.stats.answers_accepted, icon: Check,         color: 'text-emerald' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="rounded-2xl bg-surface-200/60 border border-surface-300/60 p-3 text-center"
              >
                <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} />
                <p className="font-mono text-xl font-bold text-white">{value}</p>
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>
        ) : null}

        {/* Expertise badges */}
        {!loading && data && data.expertise.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2.5">
              <Award className="h-3.5 w-3.5 text-gold" />
              <span className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
                Your Expertise
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.expertise.map((e) => {
                const style = TIER_STYLE[e.tier] ?? TIER_STYLE.contributor
                return (
                  <span
                    key={e.category}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono font-semibold',
                      style.className
                    )}
                  >
                    {e.category}
                    <span className="opacity-60">·</span>
                    {style.label}
                    {e.accepted_count > 0 && (
                      <span className="opacity-60 font-normal">({e.accepted_count})</span>
                    )}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-semibold',
                'border transition-all',
                tab === id
                  ? 'bg-purple/20 border-purple/40 text-purple'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {!loading && tabCount[id] > 0 && (
                <span
                  className={cn(
                    'ml-0.5 px-1.5 py-0.5 rounded-full text-[10px]',
                    tab === id ? 'bg-purple/30 text-purple' : 'bg-surface-300 text-surface-500'
                  )}
                >
                  {tabCount[id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-surface-200/60 border border-surface-300/60 p-4">
                <Skeleton className="h-3 w-1/3 rounded mb-2" />
                <Skeleton className="h-4 w-full rounded mb-1" />
                <Skeleton className="h-4 w-4/5 rounded mb-3" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-20 rounded" />
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {tab === 'questions' && (
                <div className="space-y-3">
                  {data?.questions.length === 0 ? (
                    <EmptyState
                      icon={HelpCircle}
                      title="No questions yet"
                      description="Ask clarifying questions from any topic page — navigate to a debate and open Community Q&A."
                      action={
                        <Link
                          href="/"
                          className="inline-flex items-center gap-1.5 text-xs font-mono text-purple hover:text-white transition-colors"
                        >
                          Browse topics
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      }
                    />
                  ) : (
                    data?.questions.map((q) => <QuestionCard key={q.id} q={q} />)
                  )}
                </div>
              )}

              {tab === 'answers' && (
                <div className="space-y-3">
                  {data?.answers.length === 0 ? (
                    <EmptyState
                      icon={MessageSquare}
                      title="No answers yet"
                      description="Browse open questions and share your knowledge — the community is waiting."
                      action={
                        <Link
                          href="/questions"
                          className="inline-flex items-center gap-1.5 text-xs font-mono text-purple hover:text-white transition-colors"
                        >
                          Browse Q&amp;A Hub
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      }
                    />
                  ) : (
                    data?.answers.map((a) => <AnswerCard key={a.id} a={a} />)
                  )}
                </div>
              )}

              {tab === 'expert' && (
                <div className="space-y-3">
                  {(data?.expertise ?? []).filter(
                    (e) => e.tier === 'expert' || e.tier === 'sage'
                  ).length === 0 ? (
                    <EmptyState
                      icon={Lightbulb}
                      title="Earn expert status first"
                      description="Get 3 answers accepted in a category to reach Expert tier — then personalized question picks appear here."
                      action={
                        <Link
                          href="/questions"
                          className="inline-flex items-center gap-1.5 text-xs font-mono text-purple hover:text-white transition-colors"
                        >
                          Answer questions
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      }
                    />
                  ) : data?.opportunities.length === 0 ? (
                    <EmptyState
                      icon={Check}
                      title="All caught up"
                      description="No open questions in your expert categories right now. Check back soon."
                    />
                  ) : (
                    <>
                      <p className="text-xs font-mono text-surface-500 mb-4">
                        Unanswered questions in your expert categories — your knowledge can help.
                      </p>
                      {data?.opportunities.map((q) => <OpportunityCard key={q.id} q={q} />)}
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Upvote totals footer */}
        {!loading && data && (data.stats.total_question_upvotes > 0 || data.stats.total_answer_upvotes > 0) && (
          <div className="mt-8 rounded-2xl bg-surface-200/40 border border-surface-300/40 p-4">
            <div className="flex items-center gap-6 text-center justify-center">
              {data.stats.total_question_upvotes > 0 && (
                <div>
                  <p className="font-mono text-lg font-bold text-for-400">{data.stats.total_question_upvotes}</p>
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Question upvotes</p>
                </div>
              )}
              {data.stats.total_answer_upvotes > 0 && (
                <div>
                  <p className="font-mono text-lg font-bold text-emerald">{data.stats.total_answer_upvotes}</p>
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Answer upvotes</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
