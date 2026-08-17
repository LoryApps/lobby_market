import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface NetworkQuestionActor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export interface NetworkQuestionTopic {
  id: string
  statement: string
  category: string | null
  status: string
}

export interface NetworkQuestionItem {
  item_id: string
  event_type: 'asked' | 'answered'
  occurred_at: string
  actor: NetworkQuestionActor
  topic: NetworkQuestionTopic
  question_id: string
  question_content: string
  question_upvotes: number
  question_answer_count: number
  is_answered: boolean
  answer_content: string | null
  answer_upvotes: number | null
}

export interface NetworkQuestionsResponse {
  items: NetworkQuestionItem[]
  following_count: number
  is_empty: boolean
  cursor: string | null
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const limit = Math.min(parseInt(searchParams.get('limit') || '40', 10), 80)
  const cursor = searchParams.get('cursor') ?? null
  const filter = searchParams.get('filter') ?? 'all' // 'all' | 'questions' | 'answers'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Fetch IDs of users this person follows
  const { data: follows, error: followErr } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', user.id)

  if (followErr) {
    return NextResponse.json({ error: 'Failed to fetch follows' }, { status: 500 })
  }

  const followingIds = (follows ?? []).map((f) => f.following_id as string)

  if (followingIds.length === 0) {
    return NextResponse.json({
      items: [],
      following_count: 0,
      is_empty: true,
      cursor: null,
    } satisfies NetworkQuestionsResponse)
  }

  const items: NetworkQuestionItem[] = []

  // 2. Fetch questions asked by followed users
  if (filter === 'all' || filter === 'questions') {
    let qQuery = supabase
      .from('topic_questions')
      .select(`
        id,
        content,
        upvotes,
        answer_count,
        is_answered,
        created_at,
        author_id,
        topic_id,
        profiles!topic_questions_author_id_fkey(id, username, display_name, avatar_url, role),
        topics!topic_questions_topic_id_fkey(id, statement, category, status)
      `)
      .in('author_id', followingIds)
      .order('created_at', { ascending: false })
      .limit(filter === 'all' ? Math.ceil(limit * 0.6) : limit)

    if (cursor && filter !== 'answers') {
      qQuery = qQuery.lt('created_at', cursor)
    }

    const { data: questions } = await qQuery

    for (const q of questions ?? []) {
      const actor = Array.isArray(q.profiles) ? q.profiles[0] : q.profiles
      const topic = Array.isArray(q.topics) ? q.topics[0] : q.topics
      if (!actor || !topic) continue

      items.push({
        item_id: `q-${q.id}`,
        event_type: 'asked',
        occurred_at: q.created_at,
        actor: {
          id: (actor as { id: string }).id,
          username: (actor as { username: string }).username,
          display_name: (actor as { display_name: string | null }).display_name,
          avatar_url: (actor as { avatar_url: string | null }).avatar_url,
          role: (actor as { role: string }).role,
        },
        topic: {
          id: (topic as { id: string }).id,
          statement: (topic as { statement: string }).statement,
          category: (topic as { category: string | null }).category,
          status: (topic as { status: string }).status,
        },
        question_id: q.id,
        question_content: q.content,
        question_upvotes: q.upvotes,
        question_answer_count: q.answer_count,
        is_answered: q.is_answered,
        answer_content: null,
        answer_upvotes: null,
      })
    }
  }

  // 3. Fetch answers posted by followed users
  if (filter === 'all' || filter === 'answers') {
    let aQuery = supabase
      .from('topic_answers')
      .select(`
        id,
        content,
        upvotes,
        is_accepted,
        created_at,
        author_id,
        topic_id,
        question_id,
        profiles!topic_answers_author_id_fkey(id, username, display_name, avatar_url, role),
        topics!topic_answers_topic_id_fkey(id, statement, category, status),
        topic_questions!topic_answers_question_id_fkey(id, content, upvotes, answer_count, is_answered)
      `)
      .in('author_id', followingIds)
      .order('created_at', { ascending: false })
      .limit(filter === 'all' ? Math.ceil(limit * 0.4) : limit)

    if (cursor && filter !== 'questions') {
      aQuery = aQuery.lt('created_at', cursor)
    }

    const { data: answers } = await aQuery

    for (const a of answers ?? []) {
      const actor = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles
      const topic = Array.isArray(a.topics) ? a.topics[0] : a.topics
      const question = Array.isArray(a.topic_questions) ? a.topic_questions[0] : a.topic_questions
      if (!actor || !topic || !question) continue

      items.push({
        item_id: `a-${a.id}`,
        event_type: 'answered',
        occurred_at: a.created_at,
        actor: {
          id: (actor as { id: string }).id,
          username: (actor as { username: string }).username,
          display_name: (actor as { display_name: string | null }).display_name,
          avatar_url: (actor as { avatar_url: string | null }).avatar_url,
          role: (actor as { role: string }).role,
        },
        topic: {
          id: (topic as { id: string }).id,
          statement: (topic as { statement: string }).statement,
          category: (topic as { category: string | null }).category,
          status: (topic as { status: string }).status,
        },
        question_id: a.question_id,
        question_content: (question as { content: string }).content,
        question_upvotes: (question as { upvotes: number }).upvotes,
        question_answer_count: (question as { answer_count: number }).answer_count,
        is_answered: (question as { is_answered: boolean }).is_answered,
        answer_content: a.content,
        answer_upvotes: a.upvotes,
      })
    }
  }

  // Sort by time descending
  items.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())

  const paged = items.slice(0, limit)
  const lastItem = paged[paged.length - 1]
  const nextCursor = paged.length === limit && lastItem ? lastItem.occurred_at : null

  return NextResponse.json({
    items: paged,
    following_count: followingIds.length,
    is_empty: items.length === 0,
    cursor: nextCursor,
  } satisfies NetworkQuestionsResponse)
}
