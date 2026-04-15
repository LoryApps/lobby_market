import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { VoteSide } from '@/lib/supabase/types'
import { checkAndGrantAchievements } from '@/lib/achievements'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { side?: VoteSide }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { side } = body

  if (!side || (side !== 'blue' && side !== 'red')) {
    return NextResponse.json(
      { error: 'Side must be "blue" or "red"' },
      { status: 400 }
    )
  }

  // Fetch topic
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('*')
    .eq('id', params.id)
    .single()

  if (topicError || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  if (topic.status !== 'active' && topic.status !== 'voting') {
    return NextResponse.json(
      { error: 'Topic is not open for voting' },
      { status: 400 }
    )
  }

  // Check if user already voted
  const { data: existingVote } = await supabase
    .from('votes')
    .select('id')
    .eq('user_id', user.id)
    .eq('topic_id', params.id)
    .maybeSingle()

  if (existingVote) {
    return NextResponse.json(
      { error: 'You have already voted on this topic' },
      { status: 409 }
    )
  }

  // Cast vote
  const { error: voteError } = await supabase.from('votes').insert({
    user_id: user.id,
    topic_id: params.id,
    side,
  })

  if (voteError) {
    return NextResponse.json(
      { error: 'Failed to cast vote' },
      { status: 500 }
    )
  }

  // Fetch updated topic counts
  const { data: updatedTopic } = await supabase
    .from('topics')
    .select('*')
    .eq('id', params.id)
    .single()

  // Check and grant achievements in the background (non-blocking to the caller)
  checkAndGrantAchievements(user.id, supabase).catch(() => {/* best-effort */})

  return NextResponse.json({ success: true, topic: updatedTopic })
}
