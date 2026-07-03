import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface AnswerAuthor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
}

export interface TopicAnswer {
  id: string
  question_id: string
  author_id: string
  content: string
  upvotes: number
  is_accepted: boolean
  created_at: string
  author: AnswerAuthor | null
  user_voted: boolean
}

// GET /api/topics/[id]/questions/[qid]/answers

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; qid: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: rawAnswers, error } = await supabase
      .from('topic_answers')
      .select('*')
      .eq('question_id', params.qid)
      .order('is_accepted', { ascending: false })
      .order('upvotes', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(50)

    if (error) throw error

    const answers = rawAnswers ?? []
    if (answers.length === 0) return NextResponse.json({ answers: [] })

    const authorIds = [...new Set(answers.map((a) => a.author_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .in('id', authorIds)

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

    let votedIds = new Set<string>()
    if (user) {
      const { data: votes } = await supabase
        .from('topic_answer_votes')
        .select('answer_id')
        .eq('user_id', user.id)
        .in('answer_id', answers.map((a) => a.id))
      votedIds = new Set((votes ?? []).map((v) => v.answer_id))
    }

    const enriched: TopicAnswer[] = answers.map((a) => ({
      id: a.id,
      question_id: a.question_id,
      author_id: a.author_id,
      content: a.content,
      upvotes: a.upvotes,
      is_accepted: a.is_accepted,
      created_at: a.created_at,
      author: profileMap.get(a.author_id) ?? null,
      user_voted: votedIds.has(a.id),
    }))

    return NextResponse.json({ answers: enriched })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST /api/topics/[id]/questions/[qid]/answers

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; qid: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const content = typeof body.content === 'string' ? body.content.trim() : ''
    if (content.length < 10 || content.length > 1000) {
      return NextResponse.json({ error: 'Answer must be 10–1000 characters' }, { status: 400 })
    }

    const { data: answer, error } = await supabase
      .from('topic_answers')
      .insert({ question_id: params.qid, topic_id: params.id, author_id: user.id, content })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ answer }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
