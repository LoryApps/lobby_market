import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/continuations/[id]/boost
// Boost a continuation. Unique(continuation_id, user_id) — the DB trigger
// handles the boost_count/endorsement_count increment.
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch the continuation + parent topic to validate state
  const { data: continuation, error: contError } = await supabase
    .from('continuations')
    .select('id, topic_id')
    .eq('id', params.id)
    .single()

  if (contError || !continuation) {
    return NextResponse.json(
      { error: 'Continuation not found' },
      { status: 404 }
    )
  }

  const { data: topic } = await supabase
    .from('topics')
    .select('status, continuation_window_ends_at')
    .eq('id', continuation.topic_id)
    .single()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  if (topic.status !== 'continued') {
    return NextResponse.json(
      { error: 'Topic is not in a boostable phase' },
      { status: 400 }
    )
  }

  if (
    topic.continuation_window_ends_at &&
    new Date(topic.continuation_window_ends_at).getTime() <= Date.now()
  ) {
    return NextResponse.json(
      { error: 'Authoring window has closed' },
      { status: 400 }
    )
  }

  // Insert — UNIQUE (continuation_id, user_id) enforces a single boost per user
  const { error: insertError } = await supabase
    .from('continuation_boosts')
    .insert({
      continuation_id: params.id,
      user_id: user.id,
    })

  if (insertError) {
    // Postgres unique_violation
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: 'You have already boosted this continuation' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: insertError.message ?? 'Failed to boost continuation' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
