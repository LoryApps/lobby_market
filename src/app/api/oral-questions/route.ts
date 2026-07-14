import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const archive = searchParams.get('archive') === 'true'
  const sessionId = searchParams.get('session_id')

  const { data: { user } } = await supabase.auth.getUser()

  if (archive) {
    const { data: sessions, error } = await supabase
      .from('civic_oral_question_sessions')
      .select('id, department, department_slug, spokesperson_name, week_start, week_end, is_active')
      .order('week_start', { ascending: false })
      .limit(20)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ sessions })
  }

  // Fetch a specific past session or the active session
  const sessionQuery = sessionId
    ? supabase.from('civic_oral_question_sessions').select('*').eq('id', sessionId).single()
    : supabase.from('civic_oral_question_sessions').select('*').eq('is_active', true).single()

  const { data: session, error: sessionError } = await sessionQuery
  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 })
  if (!session) return NextResponse.json({ session: null, questions: [] })

  const { data: questions, error: qError } = await supabase
    .from('civic_oral_questions')
    .select(`
      id, question_text, upvotes, is_selected, is_answered, created_at,
      author:profiles!author_id(id, username, display_name, avatar_url),
      answers:civic_oral_answers(id, answer_text, answered_by, created_at)
    `)
    .eq('session_id', session.id)
    .order('upvotes', { ascending: false })
    .limit(50)

  if (qError) return NextResponse.json({ error: qError.message }, { status: 500 })

  // Check which questions the current user has upvoted
  let userUpvotes: string[] = []
  if (user) {
    const { data: upvoteData } = await supabase
      .from('civic_oral_question_upvotes')
      .select('question_id')
      .eq('user_id', user.id)
      .in('question_id', (questions ?? []).map((q: { id: string }) => q.id))
    userUpvotes = (upvoteData ?? []).map((u: { question_id: string }) => u.question_id)
  }

  return NextResponse.json({
    session,
    questions: questions ?? [],
    userUpvotes,
    userId: user?.id ?? null,
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { action, session_id, question_text, question_id } = body

  if (action === 'submit') {
    if (!session_id || !question_text?.trim()) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    if (question_text.trim().length < 10 || question_text.trim().length > 500) {
      return NextResponse.json({ error: 'Question must be 10–500 characters' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('civic_oral_questions')
      .insert({ session_id, author_id: user.id, question_text: question_text.trim() })
      .select('id, question_text, upvotes, is_selected, is_answered, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ question: data })
  }

  if (action === 'upvote') {
    if (!question_id) return NextResponse.json({ error: 'Missing question_id' }, { status: 400 })

    const { data: existing } = await supabase
      .from('civic_oral_question_upvotes')
      .select('question_id')
      .eq('question_id', question_id)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      await supabase.from('civic_oral_question_upvotes').delete()
        .eq('question_id', question_id).eq('user_id', user.id)
      await supabase.from('civic_oral_questions')
        .update({ upvotes: supabase.rpc('greatest', { a: 0, b: -1 }) })
        .eq('id', question_id)
      // Manual decrement
      const { data: q } = await supabase.from('civic_oral_questions').select('upvotes').eq('id', question_id).single()
      if (q) {
        await supabase.from('civic_oral_questions').update({ upvotes: Math.max(0, q.upvotes - 1) }).eq('id', question_id)
      }
      return NextResponse.json({ voted: false })
    } else {
      const { error: insertError } = await supabase
        .from('civic_oral_question_upvotes')
        .insert({ question_id, user_id: user.id })
      if (!insertError) {
        const { data: q } = await supabase.from('civic_oral_questions').select('upvotes').eq('id', question_id).single()
        if (q) {
          await supabase.from('civic_oral_questions').update({ upvotes: q.upvotes + 1 }).eq('id', question_id)
        }
      }
      return NextResponse.json({ voted: true })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
