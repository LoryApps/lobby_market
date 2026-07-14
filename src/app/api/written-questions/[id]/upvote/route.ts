import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params

  // Try to insert (idempotent)
  const { error } = await supabase
    .from('civic_written_question_upvotes')
    .insert({ question_id: id, user_id: user.id })

  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Recount
  const { count } = await supabase
    .from('civic_written_question_upvotes')
    .select('*', { count: 'exact', head: true })
    .eq('question_id', id)

  await supabase
    .from('civic_written_questions')
    .update({ upvotes: count ?? 0 })
    .eq('id', id)

  return NextResponse.json({ upvotes: count ?? 0 })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params

  await supabase
    .from('civic_written_question_upvotes')
    .delete()
    .eq('question_id', id)
    .eq('user_id', user.id)

  const { count } = await supabase
    .from('civic_written_question_upvotes')
    .select('*', { count: 'exact', head: true })
    .eq('question_id', id)

  await supabase
    .from('civic_written_questions')
    .update({ upvotes: count ?? 0 })
    .eq('id', id)

  return NextResponse.json({ upvotes: count ?? 0 })
}
