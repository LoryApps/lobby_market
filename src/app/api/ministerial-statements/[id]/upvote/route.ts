import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── POST /api/ministerial-statements/[id]/upvote ────────────────────────────
// Toggle upvote on a statement

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { question_id?: string } = {}
  try { body = await request.json() } catch { /* no body needed for statement upvote */ }

  // If question_id provided, toggle question upvote; otherwise toggle statement upvote
  if (body.question_id) {
    const { data: existing } = await supabase
      .from('ministerial_statement_question_upvotes')
      .select('question_id')
      .eq('question_id', body.question_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('ministerial_statement_question_upvotes')
        .delete()
        .eq('question_id', body.question_id)
        .eq('user_id', user.id)
      // Decrement
      await supabase
        .from('ministerial_statement_questions')
        .update({ upvotes: 0 }) // placeholder; real decrement via count(*) below
        .eq('id', body.question_id)
      const { count } = await supabase
        .from('ministerial_statement_question_upvotes')
        .select('question_id', { count: 'exact', head: true })
        .eq('question_id', body.question_id)
      await supabase
        .from('ministerial_statement_questions')
        .update({ upvotes: count ?? 0 })
        .eq('id', body.question_id)
      return NextResponse.json({ upvoted: false })
    }

    await supabase
      .from('ministerial_statement_question_upvotes')
      .insert({ question_id: body.question_id, user_id: user.id })
    const { count } = await supabase
      .from('ministerial_statement_question_upvotes')
      .select('question_id', { count: 'exact', head: true })
      .eq('question_id', body.question_id)
    await supabase
      .from('ministerial_statement_questions')
      .update({ upvotes: count ?? 0 })
      .eq('id', body.question_id)
    return NextResponse.json({ upvoted: true })
  }

  // Toggle statement upvote
  const { data: existing } = await supabase
    .from('ministerial_statement_upvotes')
    .select('statement_id')
    .eq('statement_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('ministerial_statement_upvotes')
      .delete()
      .eq('statement_id', params.id)
      .eq('user_id', user.id)
    const { count } = await supabase
      .from('ministerial_statement_upvotes')
      .select('statement_id', { count: 'exact', head: true })
      .eq('statement_id', params.id)
    await supabase
      .from('ministerial_statements')
      .update({ upvote_count: count ?? 0 })
      .eq('id', params.id)
    return NextResponse.json({ upvoted: false, count: count ?? 0 })
  }

  await supabase
    .from('ministerial_statement_upvotes')
    .insert({ statement_id: params.id, user_id: user.id })
  const { count } = await supabase
    .from('ministerial_statement_upvotes')
    .select('statement_id', { count: 'exact', head: true })
    .eq('statement_id', params.id)
  await supabase
    .from('ministerial_statements')
    .update({ upvote_count: count ?? 0 })
    .eq('id', params.id)
  return NextResponse.json({ upvoted: true, count: count ?? 0 })
}
