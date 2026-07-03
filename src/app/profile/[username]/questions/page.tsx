import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  MessageSquare,
  Star,
  ThumbsUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lobby.market'

interface PageProps {
  params: { username: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const CATEGORY_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',       bg: 'bg-for-500/10',       border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',        bg: 'bg-purple/10',        border: 'border-purple/30' },
  Science:     { text: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Ethics:      { text: 'text-for-300',       bg: 'bg-for-300/10',       border: 'border-for-300/30' },
  Philosophy:  { text: 'text-purple',        bg: 'bg-purple/10',        border: 'border-purple/30' },
  Culture:     { text: 'text-against-300',   bg: 'bg-against-400/10',   border: 'border-against-400/30' },
  Health:      { text: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Education:   { text: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30' },
}

function getCategoryColor(cat: string | null) {
  return CATEGORY_COLOR[cat ?? ''] ?? { text: 'text-surface-400', bg: 'bg-surface-300/30', border: 'border-surface-400/30' }
}

const TIER_CONFIG: Record<string, { label: string; text: string; bg: string; border: string }> = {
  sage:        { label: 'Sage',        text: 'text-gold',    bg: 'bg-gold/10',    border: 'border-gold/30' },
  expert:      { label: 'Expert',      text: 'text-purple',  bg: 'bg-purple/10',  border: 'border-purple/30' },
  contributor: { label: 'Contributor', text: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, username')
    .eq('username', params.username)
    .single()

  const name = profile?.display_name ?? params.username
  const desc = `Questions asked and answers given by ${name} on Lobby Market. See their Q&A expertise by category.`

  return {
    title: `${name}'s Q&A Activity · Lobby Market`,
    description: desc,
    openGraph: {
      title: `${name}'s Q&A Activity`,
      description: desc,
      type: 'profile',
      siteName: 'Lobby Market',
      url: `${BASE_URL}/profile/${params.username}/questions`,
    },
    twitter: {
      card: 'summary',
      title: `${name}'s Q&A Activity · Lobby Market`,
      description: desc,
    },
  }
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent = 'neutral',
}: {
  label: string
  value: string | number
  sub?: string
  accent?: 'for' | 'against' | 'gold' | 'emerald' | 'purple' | 'neutral'
}) {
  const accentClass = {
    for:     'text-for-400',
    against: 'text-against-400',
    gold:    'text-gold',
    emerald: 'text-emerald',
    purple:  'text-purple',
    neutral: 'text-white',
  }[accent]

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 flex flex-col gap-1">
      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">{label}</span>
      <span className={cn('text-2xl font-black font-mono leading-none', accentClass)}>{value}</span>
      {sub && <span className="text-[10px] font-mono text-surface-600">{sub}</span>}
    </div>
  )
}

// ─── Question row ─────────────────────────────────────────────────────────────

function QuestionRow({
  q,
}: {
  q: {
    id: string
    content: string
    upvotes: number
    answer_count: number
    is_answered: boolean
    created_at: string
    topic_id: string
    topic_statement: string
    topic_category: string | null
  }
}) {
  const colors = getCategoryColor(q.topic_category)

  return (
    <Link
      href={`/questions/${q.id}`}
      className="flex items-start gap-3 rounded-xl border border-surface-300/60 bg-surface-100/50 p-4 hover:bg-surface-200/70 hover:border-surface-400/50 transition-all group"
    >
      <div className={cn(
        'mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center',
        q.is_answered
          ? 'bg-emerald/10 border-emerald/30 text-emerald'
          : 'bg-surface-200 border-surface-400/30 text-surface-500',
      )}>
        {q.is_answered
          ? <CheckCircle2 className="h-3.5 w-3.5" />
          : <HelpCircle className="h-3.5 w-3.5" />}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-surface-700 group-hover:text-white transition-colors leading-snug line-clamp-2">
          {q.content}
        </p>
        <p className="text-[10px] font-mono text-surface-600 mt-1 line-clamp-1 group-hover:text-surface-400 transition-colors">
          {q.topic_statement}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {q.topic_category && (
            <span className={cn(
              'text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border',
              colors.text, colors.bg, colors.border,
            )}>
              {q.topic_category}
            </span>
          )}
          <span className="flex items-center gap-0.5 text-[10px] font-mono text-surface-500">
            <ThumbsUp className="h-2.5 w-2.5" />
            {q.upvotes}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] font-mono text-surface-500">
            <MessageSquare className="h-2.5 w-2.5" />
            {q.answer_count} answer{q.answer_count !== 1 ? 's' : ''}
          </span>
          {q.is_answered && (
            <span className="text-[9px] font-mono text-emerald">Answered</span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <span className="text-[10px] font-mono text-surface-500">{relativeTime(q.created_at)}</span>
        <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors" />
      </div>
    </Link>
  )
}

// ─── Answer row ───────────────────────────────────────────────────────────────

function AnswerRow({
  a,
}: {
  a: {
    id: string
    content: string
    upvotes: number
    is_accepted: boolean
    created_at: string
    topic_id: string
    topic_statement: string
    topic_category: string | null
    question_content: string
  }
}) {
  const colors = getCategoryColor(a.topic_category)

  return (
    <Link
      href={`/questions/${a.id}`}
      className="flex items-start gap-3 rounded-xl border border-surface-300/60 bg-surface-100/50 p-4 hover:bg-surface-200/70 hover:border-surface-400/50 transition-all group"
    >
      <div className={cn(
        'mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center',
        a.is_accepted
          ? 'bg-gold/10 border-gold/30 text-gold'
          : 'bg-surface-200 border-surface-400/30 text-surface-500',
      )}>
        {a.is_accepted
          ? <Star className="h-3.5 w-3.5" />
          : <MessageSquare className="h-3.5 w-3.5" />}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-surface-700 group-hover:text-white transition-colors leading-snug line-clamp-2">
          {a.content}
        </p>
        <p className="text-[10px] font-mono text-surface-600 mt-1 italic line-clamp-1 group-hover:text-surface-400 transition-colors">
          Re: {a.question_content}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {a.topic_category && (
            <span className={cn(
              'text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border',
              colors.text, colors.bg, colors.border,
            )}>
              {a.topic_category}
            </span>
          )}
          <span className="flex items-center gap-0.5 text-[10px] font-mono text-surface-500">
            <ThumbsUp className="h-2.5 w-2.5" />
            {a.upvotes}
          </span>
          {a.is_accepted && (
            <span className="flex items-center gap-0.5 text-[9px] font-mono text-gold">
              <Star className="h-2.5 w-2.5" />
              Accepted answer
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <span className="text-[10px] font-mono text-surface-500">{relativeTime(a.created_at)}</span>
        <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors" />
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfileQuestionsPage({ params }: PageProps) {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .eq('username', params.username)
    .single()

  if (!profile) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  const isOwner = user?.id === profile.id
  const displayName = profile.display_name ?? profile.username

  // Fetch questions asked by user
  const { data: questionsRaw } = await supabase
    .from('topic_questions')
    .select('id, content, upvotes, answer_count, is_answered, created_at, topic_id')
    .eq('author_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const questions = questionsRaw ?? []

  // Fetch answers given by user
  const { data: answersRaw } = await supabase
    .from('topic_answers')
    .select('id, content, upvotes, is_accepted, created_at, topic_id, question_id')
    .eq('author_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const answers = answersRaw ?? []

  // Fetch expertise badges
  const { data: expertiseRaw } = await supabase
    .from('qa_user_expertise')
    .select('category, accepted_count, tier')
    .eq('user_id', profile.id)
    .order('accepted_count', { ascending: false })

  const expertise = expertiseRaw ?? []

  // Fetch topic info for questions
  const questionTopicIds = [...new Set(questions.map((q) => q.topic_id))]
  const answerTopicIds = [...new Set(answers.map((a) => a.topic_id))]
  const allTopicIds = [...new Set([...questionTopicIds, ...answerTopicIds])]

  const topicMap = new Map<string, { id: string; statement: string; category: string | null }>()
  if (allTopicIds.length > 0) {
    const { data: topics } = await supabase
      .from('topics')
      .select('id, statement, category')
      .in('id', allTopicIds)
    for (const t of topics ?? []) topicMap.set(t.id, t)
  }

  // Fetch question content for answers
  const answerQuestionIds = [...new Set(answers.map((a) => a.question_id))]
  const questionContentMap = new Map<string, string>()
  if (answerQuestionIds.length > 0) {
    const { data: qs } = await supabase
      .from('topic_questions')
      .select('id, content')
      .in('id', answerQuestionIds)
    for (const q of qs ?? []) questionContentMap.set(q.id, q.content)
  }

  // Assemble rows
  const questionRows = questions.map((q) => {
    const t = topicMap.get(q.topic_id)
    return {
      id: q.id,
      content: q.content,
      upvotes: q.upvotes,
      answer_count: q.answer_count,
      is_answered: q.is_answered,
      created_at: q.created_at,
      topic_id: q.topic_id,
      topic_statement: t?.statement ?? 'Topic',
      topic_category: t?.category ?? null,
    }
  })

  const answerRows = answers.map((a) => {
    const t = topicMap.get(a.topic_id)
    return {
      id: a.question_id,
      content: a.content,
      upvotes: a.upvotes,
      is_accepted: a.is_accepted,
      created_at: a.created_at,
      topic_id: a.topic_id,
      topic_statement: t?.statement ?? 'Topic',
      topic_category: t?.category ?? null,
      question_content: questionContentMap.get(a.question_id) ?? 'Question',
    }
  })

  // Stats
  const totalQuestions = questions.length
  const totalAnswers = answers.length
  const acceptedAnswers = answers.filter((a) => a.is_accepted).length
  const acceptanceRate = totalAnswers > 0 ? Math.round((acceptedAnswers / totalAnswers) * 100) : null
  const topExpertise = expertise[0]

  const hasActivity = totalQuestions > 0 || totalAnswers > 0

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 pb-24 md:pt-8">

        {/* ── Back link ─────────────────────────────────────────────── */}
        <Link
          href={`/profile/${profile.username}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to profile
        </Link>

        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-6">
          <Avatar
            src={profile.avatar_url}
            username={profile.username}
            size={48}
            className="w-12 h-12 rounded-2xl ring-2 ring-surface-400/30"
          />
          <div>
            <h1 className="font-mono text-xl font-bold text-white leading-tight">
              {isOwner ? 'Your' : `${displayName}'s`} Q&A Activity
            </h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              {totalQuestions} question{totalQuestions !== 1 ? 's' : ''} · {totalAnswers} answer{totalAnswers !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {!hasActivity ? (
          <EmptyState
            icon={HelpCircle}
            title={isOwner ? 'No Q&A activity yet' : `${displayName} hasn't participated in Q&A`}
            description={
              isOwner
                ? 'Ask clarifying questions on topics you follow, or answer questions from your community.'
                : 'Check back later once they start asking and answering questions.'
            }
            actions={isOwner ? [{ label: 'Browse topics', href: '/feed' }] : undefined}
          />
        ) : (
          <>
            {/* ── Stats ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard
                label="Questions"
                value={totalQuestions}
                sub={`${questions.filter((q) => q.is_answered).length} answered`}
                accent="for"
              />
              <StatCard
                label="Answers"
                value={totalAnswers}
                sub={`${acceptedAnswers} accepted`}
                accent="emerald"
              />
              <StatCard
                label="Acceptance"
                value={acceptanceRate !== null ? `${acceptanceRate}%` : '—'}
                sub="of answers accepted"
                accent={
                  acceptanceRate === null ? 'neutral'
                    : acceptanceRate >= 50 ? 'gold'
                    : 'neutral'
                }
              />
              <StatCard
                label="Top domain"
                value={topExpertise?.category ?? '—'}
                sub={topExpertise ? `${topExpertise.accepted_count} accepted` : 'No accepted answers yet'}
                accent="purple"
              />
            </div>

            {/* ── Expertise badges ──────────────────────────────────── */}
            {expertise.length > 0 && (
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-6">
                <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3">
                  Expertise badges · {expertise.length}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {expertise.map((e) => {
                    const cfg = TIER_CONFIG[e.tier] ?? TIER_CONFIG.contributor
                    const catColors = getCategoryColor(e.category)
                    return (
                      <div
                        key={e.category}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono',
                          cfg.text, cfg.bg, cfg.border,
                        )}
                      >
                        <Star className="h-3 w-3" />
                        <span className={catColors.text}>{e.category}</span>
                        <span className="text-[10px] opacity-70">{cfg.label}</span>
                        <span className="text-[9px] opacity-50">({e.accepted_count})</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Questions section ─────────────────────────────────── */}
            {questionRows.length > 0 && (
              <section className="mb-8">
                <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3">
                  Questions asked · {totalQuestions}
                </h2>
                <div className="space-y-2">
                  {questionRows.map((q) => (
                    <QuestionRow key={q.id} q={q} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Answers section ───────────────────────────────────── */}
            {answerRows.length > 0 && (
              <section className="mb-8">
                <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3">
                  Answers given · {totalAnswers}
                </h2>
                <div className="space-y-2">
                  {answerRows.map((a, i) => (
                    <AnswerRow key={`${a.id}-${i}`} a={a} />
                  ))}
                </div>
              </section>
            )}

            {/* ── CTA: browse Q&A hub ───────────────────────────────── */}
            <div className="rounded-2xl border border-purple/20 bg-purple/5 p-5 flex items-center justify-between">
              <div>
                <p className="font-mono text-sm text-white font-semibold mb-0.5">Explore the Q&A Hub</p>
                <p className="text-xs font-mono text-surface-500">Find open questions across all civic debates</p>
              </div>
              <Link
                href="/questions"
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple/20 hover:bg-purple/30 border border-purple/30 text-purple text-xs font-mono font-semibold transition-colors"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                Q&A Hub
              </Link>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
