import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface QuestionDetailAuthor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
}

export interface QuestionDetailAnswer {
  id: string
  question_id: string
  topic_id: string
  author_id: string
  content: string
  upvotes: number
  is_accepted: boolean
  created_at: string
  author: QuestionDetailAuthor | null
  user_voted: boolean
}

export interface QuestionDetail {
  id: string
  topic_id: string
  author_id: string
  content: string
  upvotes: number
  answer_count: number
  is_answered: boolean
  created_at: string
  author: QuestionDetailAuthor | null
  user_voted: boolean
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  } | null
  answers: QuestionDetailAnswer[]
}

export interface QuestionDetailResponse {
  question: QuestionDetail
}

// GET /api/questions/[id] — fetch a single question with its topic context and answers
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Fetch the question
    const { data: question, error: qError } = await supabase
      .from('topic_questions')
      .select('*')
      .eq('id', params.id)
      .maybeSingle()

    if (qError || !question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    // Fetch topic context
    const { data: topic } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .eq('id', question.topic_id)
      .maybeSingle()

    // Fetch question author
    const { data: qAuthor } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .eq('id', question.author_id)
      .maybeSingle()

    // Check if current user upvoted the question
    let questionVoted = false
    if (user) {
      const { data: qv } = await supabase
        .from('topic_question_votes')
        .select('user_id')
        .eq('user_id', user.id)
        .eq('question_id', params.id)
        .maybeSingle()
      questionVoted = !!qv
    }

    // Fetch answers
    const { data: rawAnswers } = await supabase
      .from('topic_answers')
      .select('*')
      .eq('question_id', params.id)
      .order('is_accepted', { ascending: false })
      .order('upvotes', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(100)

    const answers = rawAnswers ?? []

    // Fetch answer authors
    let answerProfiles: QuestionDetailAuthor[] = []
    if (answers.length > 0) {
      const authorIds = [...new Set(answers.map((a) => a.author_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role, clout')
        .in('id', authorIds)
      answerProfiles = profiles ?? []
    }
    const profileMap = new Map(answerProfiles.map((p) => [p.id, p]))

    // Fetch current user's answer votes
    let answerVotedIds = new Set<string>()
    if (user && answers.length > 0) {
      const { data: votes } = await supabase
        .from('topic_answer_votes')
        .select('answer_id')
        .eq('user_id', user.id)
        .in('answer_id', answers.map((a) => a.id))
      answerVotedIds = new Set((votes ?? []).map((v) => v.answer_id))
    }

    const enrichedAnswers: QuestionDetailAnswer[] = answers.map((a) => ({
      id: a.id,
      question_id: a.question_id,
      topic_id: a.topic_id,
      author_id: a.author_id,
      content: a.content,
      upvotes: a.upvotes,
      is_accepted: a.is_accepted,
      created_at: a.created_at,
      author: profileMap.get(a.author_id) ?? null,
      user_voted: answerVotedIds.has(a.id),
    }))

    const result: QuestionDetail = {
      id: question.id,
      topic_id: question.topic_id,
      author_id: question.author_id,
      content: question.content,
      upvotes: question.upvotes,
      answer_count: question.answer_count,
      is_answered: question.is_answered,
      created_at: question.created_at,
      author: qAuthor ?? null,
      user_voted: questionVoted,
      topic: topic ?? null,
      answers: enrichedAnswers,
    }

    return NextResponse.json({ question: result } satisfies QuestionDetailResponse)
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
