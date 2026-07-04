import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface TagQuestion {
  id: string
  topic_id: string
  content: string
  upvotes: number
  answer_count: number
  is_answered: boolean
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  } | null
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  } | null
  user_voted: boolean
}

export interface TagQuestionsResponse {
  questions: TagQuestion[]
  total: number
}

export async function GET(
  req: NextRequest,
  { params }: { params: { tag: string } }
) {
  try {
    const tag = decodeURIComponent(params.tag).toLowerCase()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { searchParams } = req.nextUrl
    const sort   = searchParams.get('sort')   ?? 'hot'
    const filter = searchParams.get('filter') ?? 'all'
    const limit  = Math.min(parseInt(searchParams.get('limit') ?? '30', 10), 100)

    // 1. Get all topics with this tag
    const { data: taggedTopics } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .contains('tags', [tag])
      .limit(500)

    if (!taggedTopics?.length) {
      return NextResponse.json({ questions: [], total: 0 } satisfies TagQuestionsResponse)
    }

    const topicIds = taggedTopics.map((t) => t.id)
    const topicMap = new Map(taggedTopics.map((t) => [t.id, t]))

    // 2. Fetch questions for these topics
    let query = supabase
      .from('topic_questions')
      .select('*')
      .in('topic_id', topicIds)

    if (filter === 'unanswered') {
      query = query.eq('is_answered', false)
    } else if (filter === 'answered') {
      query = query.eq('is_answered', true)
    }

    if (sort === 'new') {
      query = query.order('created_at', { ascending: false })
    } else if (sort === 'top') {
      query = query.order('upvotes', { ascending: false }).order('created_at', { ascending: false })
    } else {
      // hot: recent + upvoted
      query = query.order('created_at', { ascending: false }).order('upvotes', { ascending: false })
    }

    const { data: rawQuestions, error } = await query.limit(limit)
    if (error) throw error

    const questions = rawQuestions ?? []
    if (!questions.length) {
      return NextResponse.json({ questions: [], total: 0 } satisfies TagQuestionsResponse)
    }

    // 3. Fetch authors
    const authorIds = [...new Set(questions.map((q) => q.author_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .in('id', authorIds)

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

    // 4. Fetch current user's votes
    let votedIds = new Set<string>()
    if (user) {
      const { data: votes } = await supabase
        .from('topic_question_votes')
        .select('question_id')
        .eq('user_id', user.id)
        .in('question_id', questions.map((q) => q.id))
      votedIds = new Set((votes ?? []).map((v) => v.question_id))
    }

    // 5. Assemble
    const enriched: TagQuestion[] = questions.map((q) => ({
      id: q.id,
      topic_id: q.topic_id,
      content: q.content,
      upvotes: q.upvotes,
      answer_count: q.answer_count,
      is_answered: q.is_answered,
      created_at: q.created_at,
      author: profileMap.get(q.author_id) ?? null,
      topic: topicMap.get(q.topic_id) ?? null,
      user_voted: votedIds.has(q.id),
    }))

    return NextResponse.json({
      questions: enriched,
      total: enriched.length,
    } satisfies TagQuestionsResponse)
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
