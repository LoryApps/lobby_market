import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  // Fetch topic
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('*')
    .eq('id', params.id)
    .single()

  if (topicError || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  if (topic.status !== 'proposed') {
    return NextResponse.json(
      { error: 'Only proposed topics can be supported' },
      { status: 400 }
    )
  }

  // Check if user already supported
  const { data: existingSupport } = await supabase
    .from('topic_supports')
    .select('id')
    .eq('user_id', user.id)
    .eq('topic_id', params.id)
    .maybeSingle()

  if (existingSupport) {
    return NextResponse.json(
      { error: 'You have already supported this topic' },
      { status: 409 }
    )
  }

  // Insert support
  const { error: supportError } = await supabase
    .from('topic_supports')
    .insert({
      user_id: user.id,
      topic_id: params.id,
    })

  if (supportError) {
    return NextResponse.json(
      { error: 'Failed to support topic' },
      { status: 500 }
    )
  }

  // Fetch updated topic
  const { data: updatedTopic } = await supabase
    .from('topics')
    .select('*')
    .eq('id', params.id)
    .single()

  return NextResponse.json({ success: true, topic: updatedTopic })
}
