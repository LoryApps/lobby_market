import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // params.id is the question id; find the answer
  const { data: answer } = await supabase
    .from('civic_minister_answers')
    .select('id')
    .eq('question_id', params.id)
    .maybeSingle()

  if (!answer) return NextResponse.json({ error: 'Answer not found' }, { status: 404 })

  const { data: existing } = await supabase
    .from('civic_answer_upvotes')
    .select('answer_id')
    .eq('answer_id', answer.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('civic_answer_upvotes')
      .delete()
      .eq('answer_id', answer.id)
      .eq('user_id', user.id)
    return NextResponse.json({ upvoted: false })
  }

  const { error } = await supabase
    .from('civic_answer_upvotes')
    .insert({ answer_id: answer.id, user_id: user.id })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ upvoted: true })
}
