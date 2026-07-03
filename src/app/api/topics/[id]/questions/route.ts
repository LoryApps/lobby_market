import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface QuestionAuthor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
}

export interface TopicQuestion {
  id: string
  topic_id: string
  author_id: string
  content: string
  upvotes: number
  answer_count: number
  is_answered: boolean
  created_at: string
  author: QuestionAuthor | null
  user_voted: boolean
}

export interface QuestionsResponse {
  questions: TopicQuestion[]
  total: number
  topic: { id: string; statement: string; category: string | null } | null
}

// ─── GET /api/topics/[id]/questions ───────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const sort = req.nextUrl.searchParams.get('sort') ?? 'top'
    const filter = req.nextUrl.searchParams.get('filter') ?? 'all'

    // Fetch topic
    const { data: topic } = await supabase
      .from('topics')
      .select('id, statement, category')
      .eq('id', params.id)
      .maybeSingle()

    if (!topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }

    // Fetch questions
    let query = supabase
      .from('topic_questions')
      .select('*')
      .eq('topic_id', params.id)

    if (filter === 'unanswered') {
      query = query.eq('is_answered', false)
    } else if (filter === 'answered') {
      query = query.eq('is_answered', true)
    }

    if (sort === 'new') {
      query = query.order('created_at', { ascending: false })
    } else {
      query = query.order('upvotes', { ascending: false }).order('created_at', { ascending: false })
    }

    query = query.limit(50)

    const { data: rawQuestions, error } = await query
    if (error) throw error

    const questions = rawQuestions ?? []
    if (questions.length === 0) {
      return NextResponse.json({
        questions: [],
        total: 0,
        topic,
      } satisfies QuestionsResponse)
    }

    // Fetch authors
    const authorIds = [...new Set(questions.map((q) => q.author_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .in('id', authorIds)

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

    // Fetch current user's votes
    let votedIds = new Set<string>()
    if (user) {
      const { data: votes } = await supabase
        .from('topic_question_votes')
        .select('question_id')
        .eq('user_id', user.id)
        .in('question_id', questions.map((q) => q.id))
      votedIds = new Set((votes ?? []).map((v) => v.question_id))
    }

    const enriched: TopicQuestion[] = questions.map((q) => ({
      id: q.id,
      topic_id: q.topic_id,
      author_id: q.author_id,
      content: q.content,
      upvotes: q.upvotes,
      answer_count: q.answer_count,
      is_answered: q.is_answered,
      created_at: q.created_at,
      author: profileMap.get(q.author_id) ?? null,
      user_voted: votedIds.has(q.id),
    }))

    return NextResponse.json({
      questions: enriched,
      total: enriched.length,
      topic,
    } satisfies QuestionsResponse)
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ─── POST /api/topics/[id]/questions ──────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const content = typeof body.content === 'string' ? body.content.trim() : ''
    if (content.length < 10 || content.length > 400) {
      return NextResponse.json({ error: 'Question must be 10–400 characters' }, { status: 400 })
    }

    // Check topic exists
    const { data: topic } = await supabase
      .from('topics')
      .select('id')
      .eq('id', params.id)
      .maybeSingle()
    if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })

    const { data: question, error } = await supabase
      .from('topic_questions')
      .insert({ topic_id: params.id, author_id: user.id, content })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ question }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
