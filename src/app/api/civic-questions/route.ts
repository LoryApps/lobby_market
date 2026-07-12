import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MinisterProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  reputation_score: number
  role: string
}

export interface QuestionAnswer {
  id: string
  answer_text: string
  topic_links: string[]
  upvote_count: number
  created_at: string
  minister: MinisterProfile
  user_upvoted?: boolean
}

export interface MinisterQuestion {
  id: string
  question_text: string
  context_text: string | null
  category: string
  status: string
  upvote_count: number
  is_public: boolean
  created_at: string
  expires_at: string
  answered_at: string | null
  topic_id: string | null
  topic_statement: string | null
  questioner: MinisterProfile
  minister: MinisterProfile
  answer: QuestionAnswer | null
  user_upvoted?: boolean
}

export interface QuestionsResponse {
  questions: MinisterQuestion[]
  total: number
  category: string | null
  status: string | null
  sort: string
}

const VALID_CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Education', 'Environment',
]

// ─── GET — list questions ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const url = new URL(req.url)

  const category = url.searchParams.get('category') ?? null
  const minister = url.searchParams.get('minister') ?? null
  const status = url.searchParams.get('status') ?? null
  const sort = url.searchParams.get('sort') ?? 'hot'
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20'), 50)
  const offset = parseInt(url.searchParams.get('offset') ?? '0')

  const { data: { user } } = await supabase.auth.getUser()

  // Build query
  let query = supabase
    .from('civic_minister_questions')
    .select(`
      id,
      question_text,
      context_text,
      category,
      status,
      upvote_count,
      is_public,
      created_at,
      expires_at,
      answered_at,
      topic_id,
      questioner:profiles!civic_minister_questions_questioner_id_fkey (
        id, username, display_name, avatar_url, reputation_score, role
      ),
      minister:profiles!civic_minister_questions_minister_id_fkey (
        id, username, display_name, avatar_url, reputation_score, role
      ),
      answer:civic_minister_answers (
        id, answer_text, topic_links, upvote_count, created_at,
        minister:profiles!civic_minister_answers_minister_id_fkey (
          id, username, display_name, avatar_url, reputation_score, role
        )
      )
    `, { count: 'exact' })
    .eq('is_public', true)

  if (category && VALID_CATEGORIES.includes(category)) {
    query = query.eq('category', category)
  }
  if (minister) {
    query = query.eq('minister_id', minister)
  }
  if (status && ['open', 'answered', 'expired'].includes(status)) {
    query = query.eq('status', status)
  }

  if (sort === 'hot') {
    query = query.order('upvote_count', { ascending: false }).order('created_at', { ascending: false })
  } else if (sort === 'new') {
    query = query.order('created_at', { ascending: false })
  } else if (sort === 'answered') {
    query = query.eq('status', 'answered').order('answered_at', { ascending: false })
  } else {
    query = query.order('upvote_count', { ascending: false })
  }

  const { data: rawQuestions, count, error } = await query.range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Enrich with topic statements and user upvote status
  const questions = rawQuestions ?? []
  const questionIds = questions.map((q: Record<string, unknown>) => q.id as string)
  const answerIds = questions
    .filter((q: Record<string, unknown>) => q.answer)
    .map((q: Record<string, unknown>) => (q.answer as Record<string, unknown>).id as string)

  const topicIds = questions
    .filter((q: Record<string, unknown>) => q.topic_id)
    .map((q: Record<string, unknown>) => q.topic_id as string)

  const [topicsRes, questionUpvotesRes, answerUpvotesRes] = await Promise.all([
    topicIds.length > 0
      ? supabase.from('topics').select('id, statement').in('id', topicIds)
      : Promise.resolve({ data: [] }),
    user && questionIds.length > 0
      ? supabase
          .from('civic_question_upvotes')
          .select('question_id')
          .eq('user_id', user.id)
          .in('question_id', questionIds)
      : Promise.resolve({ data: [] }),
    user && answerIds.length > 0
      ? supabase
          .from('civic_answer_upvotes')
          .select('answer_id')
          .eq('user_id', user.id)
          .in('answer_id', answerIds)
      : Promise.resolve({ data: [] }),
  ])

  const topicMap = Object.fromEntries(
    (topicsRes.data ?? []).map((t: { id: string; statement: string }) => [t.id, t.statement])
  )
  const upvotedQuestions = new Set(
    (questionUpvotesRes.data ?? []).map((r: { question_id: string }) => r.question_id)
  )
  const upvotedAnswers = new Set(
    (answerUpvotesRes.data ?? []).map((r: { answer_id: string }) => r.answer_id)
  )

  const enriched = questions.map((q: Record<string, unknown>) => ({
    ...q,
    topic_statement: q.topic_id ? topicMap[q.topic_id as string] ?? null : null,
    user_upvoted: upvotedQuestions.has(q.id as string),
    answer: q.answer
      ? {
          ...(q.answer as Record<string, unknown>),
          user_upvoted: upvotedAnswers.has((q.answer as Record<string, unknown>).id as string),
        }
      : null,
  }))

  return NextResponse.json({
    questions: enriched,
    total: count ?? 0,
    category,
    status,
    sort,
  } satisfies QuestionsResponse)
}

// ─── POST — submit a question ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    minister_id: string
    category: string
    question_text: string
    context_text?: string
    topic_id?: string
  }

  const { minister_id, category, question_text, context_text, topic_id } = body

  if (!minister_id || !category || !question_text) {
    return NextResponse.json({ error: 'minister_id, category, question_text required' }, { status: 400 })
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }
  if (question_text.trim().length < 20) {
    return NextResponse.json({ error: 'Question must be at least 20 characters' }, { status: 400 })
  }
  if (question_text.trim().length > 500) {
    return NextResponse.json({ error: 'Question must be at most 500 characters' }, { status: 400 })
  }
  if (minister_id === user.id) {
    return NextResponse.json({ error: 'Cannot question yourself' }, { status: 400 })
  }

  // Rate limit: 5 questions per 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('civic_minister_questions')
    .select('id', { count: 'exact', head: true })
    .eq('questioner_id', user.id)
    .gte('created_at', since)

  if ((count ?? 0) >= 5) {
    return NextResponse.json({ error: 'Daily question limit reached (5 per 24h)' }, { status: 429 })
  }

  const { data, error } = await supabase
    .from('civic_minister_questions')
    .insert({
      questioner_id: user.id,
      minister_id,
      category,
      question_text: question_text.trim(),
      context_text: context_text?.trim() ?? null,
      topic_id: topic_id ?? null,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: data.id }, { status: 201 })
}
