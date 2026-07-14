import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── POST /api/ministerial-statements/[id]/questions ─────────────────────────
// Submit a supplementary question on a statement

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { content?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { content } = body
  if (!content || content.length < 10 || content.length > 500)
    return NextResponse.json({ error: 'Question must be 10–500 characters' }, { status: 400 })

  // Verify statement exists
  const { data: statement } = await supabase
    .from('ministerial_statements')
    .select('id, minister_id')
    .eq('id', params.id)
    .eq('status', 'published')
    .single()
  if (!statement) return NextResponse.json({ error: 'Statement not found' }, { status: 404 })

  // Can't question your own statement
  if (statement.minister_id === user.id)
    return NextResponse.json({ error: 'Cannot question your own statement' }, { status: 400 })

  const { data: question, error } = await supabase
    .from('ministerial_statement_questions')
    .insert({
      statement_id:  params.id,
      questioner_id: user.id,
      content:       content.trim(),
    })
    .select(`
      id, content, upvotes, created_at,
      questioner:questioner_id (id, username, display_name, avatar_url, role)
    `)
    .single()

  if (error) {
    if (error.code === '23505')
      return NextResponse.json({ error: 'You have already submitted a question on this statement' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Increment question_count on statement
  await supabase.rpc('increment', { table_name: 'ministerial_statements', column_name: 'question_count', row_id: params.id }).catch(() => {
    // Fallback: raw update
    supabase.from('ministerial_statements').update({ question_count: (statement as { question_count?: number }).question_count ?? 0 + 1 }).eq('id', params.id).then(() => {})
  })

  return NextResponse.json({ question }, { status: 201 })
}

// ─── PATCH /api/ministerial-statements/[id]/questions ────────────────────────
// Minister responds to a question

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { question_id?: string; response?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { question_id, response } = body
  if (!question_id) return NextResponse.json({ error: 'question_id required' }, { status: 400 })
  if (!response || response.length < 10 || response.length > 1000)
    return NextResponse.json({ error: 'Response must be 10–1000 characters' }, { status: 400 })

  // Only the minister who made the statement can respond
  const { data: statement } = await supabase
    .from('ministerial_statements')
    .select('minister_id')
    .eq('id', params.id)
    .single()
  if (!statement || statement.minister_id !== user.id)
    return NextResponse.json({ error: 'Only the statement author can respond' }, { status: 403 })

  const { data: question, error } = await supabase
    .from('ministerial_statement_questions')
    .update({
      ministerial_response: response.trim(),
      responded_at:         new Date().toISOString(),
      responded_by:         user.id,
    })
    .eq('id', question_id)
    .eq('statement_id', params.id)
    .select('id, ministerial_response, responded_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ question })
}
