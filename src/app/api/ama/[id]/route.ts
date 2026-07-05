import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AMASession } from '../route'

export const dynamic = 'force-dynamic'

export interface AMAQuestion {
  id: string
  session_id: string
  author_id: string
  content: string
  upvotes: number
  is_answered: boolean
  is_pinned: boolean
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  answer: AMAAnswer | null
  user_voted: boolean
}

export interface AMAAnswer {
  id: string
  question_id: string
  content: string
  created_at: string
}

export interface AMASessionDetail extends AMASession {
  questions: AMAQuestion[]
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: row, error } = await supabase
      .from('ama_sessions')
      .select('*')
      .eq('id', params.id)
      .maybeSingle()

    if (error) throw error
    if (!row) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    // Fetch host profile
    const { data: host } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .eq('id', row.host_id)
      .maybeSingle()

    // Check user RSVP
    let user_rsvped = false
    if (user) {
      const { data: rsvp } = await supabase
        .from('ama_rsvps')
        .select('user_id')
        .eq('session_id', params.id)
        .eq('user_id', user.id)
        .maybeSingle()
      user_rsvped = !!rsvp
    }

    // Fetch questions ordered by: pinned first, then upvotes, then created_at
    const { data: questionRows } = await supabase
      .from('ama_questions')
      .select('*')
      .eq('session_id', params.id)
      .order('is_pinned', { ascending: false })
      .order('upvotes', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(100)

    if (!questionRows || questionRows.length === 0) {
      const session: AMASession = {
        id: row.id,
        host_id: row.host_id,
        title: row.title,
        description: row.description,
        category: row.category,
        scheduled_at: row.scheduled_at,
        started_at: row.started_at,
        ended_at: row.ended_at,
        status: row.status,
        question_count: row.question_count ?? 0,
        answer_count: row.answer_count ?? 0,
        rsvp_count: row.rsvp_count ?? 0,
        created_at: row.created_at,
        host: host ?? null,
        user_rsvped,
      }
      return NextResponse.json({ ...session, questions: [] })
    }

    // Fetch authors
    const authorIds = [...new Set(questionRows.map((q) => q.author_id))]
    const { data: authors } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', authorIds)
    const authorMap = new Map((authors ?? []).map((a) => [a.id, a]))

    // Fetch answers
    const questionIds = questionRows.map((q) => q.id)
    const { data: answers } = await supabase
      .from('ama_answers')
      .select('*')
      .in('question_id', questionIds)
    const answerMap = new Map((answers ?? []).map((a) => [a.question_id, a]))

    // Fetch user votes
    let votedIds = new Set<string>()
    if (user) {
      const { data: votes } = await supabase
        .from('ama_question_votes')
        .select('question_id')
        .eq('user_id', user.id)
        .in('question_id', questionIds)
      votedIds = new Set((votes ?? []).map((v) => v.question_id))
    }

    const questions: AMAQuestion[] = questionRows.map((q) => {
      const ans = answerMap.get(q.id)
      return {
        id: q.id,
        session_id: q.session_id,
        author_id: q.author_id,
        content: q.content,
        upvotes: q.upvotes ?? 0,
        is_answered: q.is_answered ?? false,
        is_pinned: q.is_pinned ?? false,
        created_at: q.created_at,
        author: authorMap.get(q.author_id) ?? null,
        answer: ans
          ? { id: ans.id, question_id: ans.question_id, content: ans.content, created_at: ans.created_at }
          : null,
        user_voted: votedIds.has(q.id),
      }
    })

    const sessionDetail: AMASessionDetail = {
      id: row.id,
      host_id: row.host_id,
      title: row.title,
      description: row.description,
      category: row.category,
      scheduled_at: row.scheduled_at,
      started_at: row.started_at,
      ended_at: row.ended_at,
      status: row.status,
      question_count: row.question_count ?? 0,
      answer_count: row.answer_count ?? 0,
      rsvp_count: row.rsvp_count ?? 0,
      created_at: row.created_at,
      host: host ?? null,
      user_rsvped,
      questions,
    }

    return NextResponse.json(sessionDetail)
  } catch (err) {
    console.error('AMA detail error:', err)
    return NextResponse.json({ error: 'Failed to load session' }, { status: 500 })
  }
}
