import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/pmqs/questions/vote
// Body: { questionId: string }
// Toggles the authenticated user's upvote on a PMQ question.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { questionId } = await req.json()
  if (!questionId) return NextResponse.json({ error: 'questionId required' }, { status: 400 })

  // Check existing vote
  const { data: existing } = await supabase
    .from('pmq_question_votes')
    .select('question_id')
    .eq('question_id', questionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    // Remove vote
    await supabase
      .from('pmq_question_votes')
      .delete()
      .eq('question_id', questionId)
      .eq('user_id', user.id)
    return NextResponse.json({ voted: false })
  } else {
    // Can't vote on own question
    const { data: q } = await supabase
      .from('pmq_questions')
      .select('asker_id, session_id')
      .eq('id', questionId)
      .single()

    if (!q) return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    if (q.asker_id === user.id) {
      return NextResponse.json({ error: 'Cannot upvote your own question' }, { status: 400 })
    }

    await supabase.from('pmq_question_votes').insert({ question_id: questionId, user_id: user.id })
    return NextResponse.json({ voted: true })
  }
}
