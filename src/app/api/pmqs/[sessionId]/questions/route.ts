import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface PmqQuestion {
  id: string
  session_id: string
  asker_id: string
  question: string
  category: string | null
  upvotes: number
  status: 'pending' | 'selected' | 'answered' | 'skipped'
  selected_rank: number | null
  created_at: string
  asker?: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string | null
  } | null
  answer?: {
    answer: string
    created_at: string
  } | null
  has_voted?: boolean
}

export interface QuestionsResponse {
  questions: PmqQuestion[]
  my_question_id: string | null
  my_votes: string[]
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } }
): Promise<NextResponse<QuestionsResponse>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: rows } = await supabase
    .from('pmq_questions')
    .select(`
      *,
      asker:profiles!asker_id(username, display_name, avatar_url, role),
      answer:pmq_answers(answer, created_at)
    `)
    .eq('session_id', params.sessionId)
    .order('upvotes', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(200)

  const questions = (rows ?? []).map((r) => ({
    ...r,
    asker: Array.isArray(r.asker) ? r.asker[0] ?? null : r.asker ?? null,
    answer: Array.isArray(r.answer) ? r.answer[0] ?? null : r.answer ?? null,
  })) as PmqQuestion[]

  let myQuestionId: string | null = null
  let myVotes: string[] = []

  if (user) {
    const myQ = questions.find((q) => q.asker_id === user.id)
    myQuestionId = myQ?.id ?? null

    const { data: voteRows } = await supabase
      .from('pmq_question_votes')
      .select('question_id')
      .eq('user_id', user.id)

    myVotes = (voteRows ?? []).map((v) => v.question_id)
  }

  return NextResponse.json({ questions, my_question_id: myQuestionId, my_votes: myVotes })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { question, category } = await req.json()
  if (!question || typeof question !== 'string') {
    return NextResponse.json({ error: 'Question is required' }, { status: 400 })
  }
  const trimmed = question.trim()
  if (trimmed.length < 10 || trimmed.length > 280) {
    return NextResponse.json({ error: 'Question must be 10–280 characters' }, { status: 400 })
  }

  // Verify session is open
  const { data: session } = await supabase
    .from('pmq_sessions')
    .select('status, questions_due_at')
    .eq('id', params.sessionId)
    .single()

  if (!session || (session.status !== 'open' && session.status !== 'in_progress')) {
    return NextResponse.json({ error: 'Session is not accepting questions' }, { status: 400 })
  }
  if (new Date(session.questions_due_at) < new Date()) {
    return NextResponse.json({ error: 'Submission deadline has passed' }, { status: 400 })
  }

  const { data: inserted, error } = await supabase
    .from('pmq_questions')
    .insert({
      session_id: params.sessionId,
      asker_id: user.id,
      question: trimmed,
      category: category ?? null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'You have already submitted a question for this session' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ question: inserted }, { status: 201 })
}
