import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── GET /api/ministerial-statements/[id] ────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: statement, error } = await supabase
    .from('ministerial_statements')
    .select(`
      id, title, summary, body, department, category, statement_type,
      question_count, upvote_count, published_at, topic_id,
      minister:minister_id (
        id, username, display_name, avatar_url, role, clout, bio
      )
    `)
    .eq('id', params.id)
    .eq('status', 'published')
    .single()

  if (error || !statement) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fetch supplementary questions with upvote data
  const { data: questions } = await supabase
    .from('ministerial_statement_questions')
    .select(`
      id, content, upvotes, created_at,
      ministerial_response, responded_at,
      questioner:questioner_id (id, username, display_name, avatar_url, role),
      responder:responded_by (id, username, display_name, avatar_url)
    `)
    .eq('statement_id', params.id)
    .order('upvotes', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(50)

  // User's existing question + upvotes
  let userQuestion: string | null = null
  let userUpvotedStatements: boolean = false
  let userUpvotedQuestions: string[] = []

  if (user) {
    const [{ data: existingQ }, { data: statUp }, { data: qUpvotes }] = await Promise.all([
      supabase
        .from('ministerial_statement_questions')
        .select('id')
        .eq('statement_id', params.id)
        .eq('questioner_id', user.id)
        .maybeSingle(),
      supabase
        .from('ministerial_statement_upvotes')
        .select('statement_id')
        .eq('statement_id', params.id)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('ministerial_statement_question_upvotes')
        .select('question_id')
        .eq('user_id', user.id)
        .in('question_id', questions?.map((q: { id: string }) => q.id) ?? []),
    ])
    userQuestion = existingQ?.id ?? null
    userUpvotedStatements = !!statUp
    userUpvotedQuestions = qUpvotes?.map((u: { question_id: string }) => u.question_id) ?? []
  }

  // Fetch related topic if linked
  let relatedTopic: { id: string; statement: string; status: string } | null = null
  if (statement.topic_id) {
    const { data: topic } = await supabase
      .from('topics')
      .select('id, statement, status')
      .eq('id', statement.topic_id)
      .single()
    relatedTopic = topic ?? null
  }

  return NextResponse.json({
    statement,
    questions: questions ?? [],
    userQuestion,
    userUpvotedStatements,
    userUpvotedQuestions,
    userId: user?.id ?? null,
    relatedTopic,
  })
}
