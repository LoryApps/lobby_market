import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface WrittenQuestion {
  id: string
  author_id: string
  department: string
  question_text: string
  context_text: string | null
  topic_id: string | null
  upvotes: number
  status: 'open' | 'answered' | 'declined' | 'expired'
  is_urgent: boolean
  answered_at: string | null
  expires_at: string
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  } | null
  topic: { id: string; statement: string; status: string } | null
  answer: {
    id: string
    answer_text: string
    created_at: string
    answerer: {
      id: string
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
    } | null
  } | null
}

export interface WrittenQuestionsResponse {
  questions: WrittenQuestion[]
  total: number
  userUpvotes: string[]
  userId: string | null
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const department = searchParams.get('department') ?? null
  const status = searchParams.get('status') ?? 'open'
  const sort = searchParams.get('sort') ?? 'top'  // top | new | unanswered
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30'), 50)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  const { data: { user } } = await supabase.auth.getUser()

  let query = supabase
    .from('civic_written_questions')
    .select(`
      id, author_id, department, question_text, context_text,
      topic_id, upvotes, status, is_urgent, answered_at, expires_at, created_at,
      author:profiles!civic_written_questions_author_id_fkey(
        id, username, display_name, avatar_url, role, clout
      ),
      topic:topics(id, statement, status),
      answer:civic_written_answers(
        id, answer_text, created_at,
        answerer:profiles!civic_written_answers_answerer_id_fkey(
          id, username, display_name, avatar_url, role
        )
      )
    `, { count: 'exact' })

  if (department) query = query.eq('department', department)
  if (status !== 'all') {
    if (status === 'unanswered') {
      query = query.eq('status', 'open')
    } else {
      query = query.eq('status', status)
    }
  }

  if (sort === 'new') {
    query = query.order('created_at', { ascending: false })
  } else if (sort === 'urgent') {
    query = query.order('is_urgent', { ascending: false }).order('upvotes', { ascending: false })
  } else {
    // top by upvotes
    query = query.order('upvotes', { ascending: false }).order('created_at', { ascending: false })
  }

  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // User's upvotes
  let userUpvotes: string[] = []
  if (user) {
    const questionIds = (data ?? []).map((q) => q.id)
    if (questionIds.length > 0) {
      const { data: uvData } = await supabase
        .from('civic_written_question_upvotes')
        .select('question_id')
        .eq('user_id', user.id)
        .in('question_id', questionIds)
      userUpvotes = (uvData ?? []).map((r) => r.question_id)
    }
  }

  return NextResponse.json({
    questions: (data ?? []) as WrittenQuestion[],
    total: count ?? 0,
    userUpvotes,
    userId: user?.id ?? null,
  } satisfies WrittenQuestionsResponse)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { department, question_text, context_text, topic_id, is_urgent } = body

  if (!department || typeof department !== 'string') {
    return NextResponse.json({ error: 'Department is required' }, { status: 400 })
  }
  if (!question_text || question_text.trim().length < 20) {
    return NextResponse.json({ error: 'Question must be at least 20 characters' }, { status: 400 })
  }
  if (question_text.length > 600) {
    return NextResponse.json({ error: 'Question must be under 600 characters' }, { status: 400 })
  }

  // Rate-limit: max 3 open questions per user
  const { count } = await supabase
    .from('civic_written_questions')
    .select('*', { count: 'exact', head: true })
    .eq('author_id', user.id)
    .eq('status', 'open')
  if ((count ?? 0) >= 3) {
    return NextResponse.json({ error: 'You already have 3 open questions. Wait for answers before submitting more.' }, { status: 429 })
  }

  const { data, error } = await supabase
    .from('civic_written_questions')
    .insert({
      author_id: user.id,
      department: department.trim(),
      question_text: question_text.trim(),
      context_text: context_text?.trim() || null,
      topic_id: topic_id || null,
      is_urgent: Boolean(is_urgent),
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
