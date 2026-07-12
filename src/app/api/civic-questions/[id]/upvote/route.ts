import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params

  // Check if already upvoted
  const { data: existing } = await supabase
    .from('civic_question_upvotes')
    .select('question_id')
    .eq('question_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    // Remove upvote (toggle)
    await supabase
      .from('civic_question_upvotes')
      .delete()
      .eq('question_id', id)
      .eq('user_id', user.id)
    return NextResponse.json({ upvoted: false })
  }

  const { error } = await supabase
    .from('civic_question_upvotes')
    .insert({ question_id: id, user_id: user.id })

  if (error) {
    if (error.code === '23503') {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ upvoted: true })
}
