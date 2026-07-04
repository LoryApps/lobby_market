import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  Flame,
  HelpCircle,
  MessageSquare,
  Star,
  Tag,
  ThumbsUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: { tag: string }
  searchParams?: { sort?: string; filter?: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const tag = decodeURIComponent(params.tag)
  return {
    title: `Questions about #${tag} · Lobby Market`,
    description: `Browse community questions about debates tagged "${tag}" on Lobby Market.`,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const STATUS_PILL: Record<string, string> = {
  proposed: 'text-surface-500 border-surface-500/40 bg-surface-500/10',
  active:   'text-for-400 border-for-500/40 bg-for-500/10',
  voting:   'text-purple border-purple/40 bg-purple/10',
  law:      'text-gold border-gold/40 bg-gold/10',
  failed:   'text-against-400 border-against-500/40 bg-against-500/10',
}

const ROLE_PILL: Record<string, string> = {
  expert:      'bg-gold/10 text-gold border-gold/30',
  moderator:   'bg-purple/10 text-purple border-purple/30',
  contributor: 'bg-for-500/10 text-for-400 border-for-500/30',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TagQuestionsPage({ params, searchParams }: PageProps) {
  const tag    = decodeURIComponent(params.tag).toLowerCase()
  const sort   = searchParams?.sort   ?? 'hot'
  const filter = searchParams?.filter ?? 'all'

  const supabase = await createClient()

  // Verify the tag exists (has at least one topic)
  const { count: topicCount } = await supabase
    .from('topics')
    .select('id', { count: 'exact', head: true })
    .contains('tags', [tag])

  if (!topicCount) notFound()

  // Fetch all topic IDs for this tag
  const { data: taggedTopics } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .contains('tags', [tag])
    .limit(500)

  const taggedTopicsList = taggedTopics ?? []
  const topicIds = taggedTopicsList.map((t) => t.id)
  const topicMap = new Map(taggedTopicsList.map((t) => [t.id, t]))

  // Fetch questions for these topics with requested sort + filter
  let questionsQuery = supabase
    .from('topic_questions')
    .select('*')
    .in('topic_id', topicIds)

  if (filter === 'unanswered') {
    questionsQuery = questionsQuery.eq('is_answered', false)
  } else if (filter === 'answered') {
    questionsQuery = questionsQuery.eq('is_answered', true)
  }

  if (sort === 'new') {
    questionsQuery = questionsQuery.order('created_at', { ascending: false })
  } else if (sort === 'top') {
    questionsQuery = questionsQuery.order('upvotes', { ascending: false }).order('created_at', { ascending: false })
  } else {
    questionsQuery = questionsQuery.order('created_at', { ascending: false }).order('upvotes', { ascending: false })
  }

  const { data: rawQuestions } = await questionsQuery.limit(50)
  const questions = rawQuestions ?? []

  // Fetch authors
  const authorIds = [...new Set(questions.map((q) => q.author_id))]
  const { data: profiles } = authorIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role, clout')
        .in('id', authorIds)
    : { data: [] }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  // Assemble enriched questions
  const enriched = questions.map((q) => ({
    ...q,
    author: profileMap.get(q.author_id) ?? null,
    topic: topicMap.get(q.topic_id) ?? null,
  }))

  // Count totals for the filter tabs
  const totalAll        = topicIds.length ? (await supabase
    .from('topic_questions')
    .select('id', { count: 'exact', head: true })
    .in('topic_id', topicIds)).count ?? 0 : 0
  const totalUnanswered = topicIds.length ? (await supabase
    .from('topic_questions')
    .select('id', { count: 'exact', head: true })
    .in('topic_id', topicIds)
    .eq('is_answered', false)).count ?? 0 : 0
  const totalAnswered   = topicIds.length ? (await supabase
    .from('topic_questions')
    .select('id', { count: 'exact', head: true })
    .in('topic_id', topicIds)
    .eq('is_answered', true)).count ?? 0 : 0

  function href(s: string = sort, f: string = filter) {
    const p = new URLSearchParams()
    if (s !== 'hot')  p.set('sort', s)
    if (f !== 'all')  p.set('filter', f)
    const qs = p.toString()
    return `/tags/${encodeURIComponent(tag)}/questions${qs ? `?${qs}` : ''}`
  }

  const filterOpts = [
    { id: 'all',        label: 'All',        count: totalAll,        icon: HelpCircle },
    { id: 'unanswered', label: 'Unanswered', count: totalUnanswered, icon: HelpCircle },
    { id: 'answered',   label: 'Answered',   count: totalAnswered,   icon: Check      },
  ]

  const sortOpts = [
    { id: 'hot', label: 'Hot', icon: Flame },
    { id: 'new', label: 'New', icon: Clock },
    { id: 'top', label: 'Top', icon: Star  },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Back + breadcrumb ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-6 text-xs font-mono text-surface-500">
          <Link
            href="/tags"
            className="hover:text-surface-300 transition-colors"
          >
            Tags
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link
            href={`/tags/${encodeURIComponent(tag)}`}
            className="hover:text-surface-300 transition-colors"
          >
            #{tag}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-surface-300">Questions</span>
        </div>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30">
              <HelpCircle className="h-5 w-5 text-purple" aria-hidden />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                #{tag} Questions
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {totalAll} question{totalAll !== 1 ? 's' : ''} across {taggedTopicsList.length} debate{taggedTopicsList.length !== 1 ? 's' : ''}
                {totalUnanswered > 0 && (
                  <span className="text-against-400 ml-2">· {totalUnanswered} unanswered</span>
                )}
              </p>
            </div>
          </div>

          <Link
            href={`/tags/${encodeURIComponent(tag)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-all flex-shrink-0"
          >
            <Tag className="h-3.5 w-3.5" />
            Debates
          </Link>
        </div>

        {/* ── Filter + sort ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
          {/* Filter tabs */}
          <div className="flex items-center gap-1">
            {filterOpts.map((f) => (
              <Link
                key={f.id}
                href={href(sort, f.id)}
                className={cn(
                  'px-3 py-1.5 rounded-full font-mono text-xs border transition-all',
                  filter === f.id
                    ? 'bg-purple/20 text-purple border-purple/40'
                    : 'bg-surface-200/50 text-surface-500 border-surface-300 hover:text-surface-300',
                )}
              >
                {f.label}
                {f.count > 0 && (
                  <span className={cn('ml-1.5 opacity-60', filter === f.id ? 'opacity-80' : '')}>
                    {f.count}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Sort chips */}
          <div className="flex items-center gap-1">
            {sortOpts.map((s) => (
              <Link
                key={s.id}
                href={href(s.id, filter)}
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-mono text-xs border transition-all',
                  sort === s.id
                    ? 'bg-surface-300/40 text-white border-surface-400'
                    : 'bg-surface-200/50 text-surface-500 border-surface-300 hover:text-surface-300',
                )}
              >
                <s.icon className="h-3 w-3" />
                {s.label}
              </Link>
            ))}
          </div>
        </div>

        {/* ── Questions list ────────────────────────────────────────────── */}
        {enriched.length === 0 ? (
          <EmptyState
            icon={HelpCircle}
            title={
              filter === 'unanswered'
                ? `No unanswered questions tagged "${tag}"`
                : filter === 'answered'
                  ? `No answered questions tagged "${tag}"`
                  : `No questions tagged "${tag}" yet`
            }
            description="Questions are asked on individual debate pages and surface here automatically."
            actions={[
              { label: `Browse #${tag} debates`, href: `/tags/${encodeURIComponent(tag)}` },
              { label: 'All questions',           href: '/questions' },
            ]}
          />
        ) : (
          <div className="space-y-3">
            {enriched.map((q) => {
              const topic  = q.topic
              const author = q.author

              return (
                <Link
                  key={q.id}
                  href={`/questions/${q.id}`}
                  className="group block bg-surface-100/50 hover:bg-surface-100 border border-surface-200 hover:border-surface-300 rounded-xl p-4 transition-all"
                >
                  {/* Answered badge + time */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {q.is_answered ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border bg-emerald/10 text-emerald border-emerald/30">
                          <Check className="h-2.5 w-2.5" />
                          Answered
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border bg-against-500/10 text-against-400 border-against-500/30">
                          <HelpCircle className="h-2.5 w-2.5" />
                          Unanswered
                        </span>
                      )}
                      {topic?.status && (
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono border',
                          STATUS_PILL[topic.status] ?? 'bg-surface-200 text-surface-500 border-surface-300',
                        )}>
                          {topic.status.charAt(0).toUpperCase() + topic.status.slice(1)}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-surface-600">
                      {relativeTime(q.created_at)}
                    </span>
                  </div>

                  {/* Question content */}
                  <p className="font-mono text-sm text-white leading-relaxed mb-2 line-clamp-2 group-hover:text-surface-100 transition-colors">
                    {q.content}
                  </p>

                  {/* Topic reference */}
                  {topic && (
                    <p className="text-[11px] font-mono text-surface-500 mb-3 line-clamp-1">
                      re: {topic.statement}
                    </p>
                  )}

                  {/* Footer: author + stats */}
                  <div className="flex items-center justify-between gap-2 mt-1">
                    {author ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar
                          src={author.avatar_url}
                          username={author.username}
                          size={20}
                          className="flex-shrink-0"
                        />
                        <span className="font-mono text-xs text-surface-400 truncate">
                          {author.display_name ?? author.username}
                        </span>
                        {author.role && author.role !== 'user' && (
                          <span className={cn(
                            'inline-flex px-1.5 py-0.5 rounded text-[9px] font-mono border flex-shrink-0',
                            ROLE_PILL[author.role] ?? 'bg-surface-200 text-surface-500 border-surface-300',
                          )}>
                            {author.role}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div />
                    )}

                    <div className="flex items-center gap-3 text-[10px] font-mono text-surface-600 flex-shrink-0">
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3" />
                        {q.upvotes}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {q.answer_count}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* ── Bottom links ──────────────────────────────────────────────── */}
        {enriched.length > 0 && (
          <div className="mt-6 pt-5 border-t border-surface-200 flex items-center justify-between text-xs font-mono text-surface-500">
            <Link
              href={`/tags/${encodeURIComponent(tag)}`}
              className="flex items-center gap-1.5 hover:text-surface-300 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to #{tag} debates
            </Link>
            <Link
              href="/questions"
              className="flex items-center gap-1.5 hover:text-surface-300 transition-colors"
            >
              All questions
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
