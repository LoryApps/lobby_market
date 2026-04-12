import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/continuations/[id]/vote
// Cast a plurality vote for a continuation during the vote phase.
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

  // Resolve the continuation's topic
  const { data: continuation, error: contError } = await supabase
    .from('continuations')
    .select('id, topic_id, status')
    .eq('id', params.id)
    .single()

  if (contError || !continuation) {
    return NextResponse.json(
      { error: 'Continuation not found' },
      { status: 404 }
    )
  }

  // Fetch the topic to confirm we're in the vote phase
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('id, status, continuation_vote_ends_at')
    .eq('id', continuation.topic_id)
    .single()

  if (topicError || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // The migration's evaluator moves the topic into 'voting' once the authoring
  // window expires and sets continuation_vote_ends_at.
  const inVotePhase =
    topic.status === 'voting' && topic.continuation_vote_ends_at !== null
  if (!inVotePhase) {
    return NextResponse.json(
      { error: 'Topic is not in the continuation vote phase' },
      { status: 400 }
    )
  }

  if (
    topic.continuation_vote_ends_at &&
    new Date(topic.continuation_vote_ends_at).getTime() <= Date.now()
  ) {
    return NextResponse.json(
      { error: 'Continuation vote has ended' },
      { status: 400 }
    )
  }

  // Insert the vote — UNIQUE (topic_id, user_id) enforces one vote per topic
  const { error: insertError } = await supabase
    .from('continuation_votes')
    .insert({
      topic_id: topic.id,
      continuation_id: params.id,
      user_id: user.id,
    })

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: 'You have already voted in this continuation round' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: insertError.message ?? 'Failed to cast vote' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
