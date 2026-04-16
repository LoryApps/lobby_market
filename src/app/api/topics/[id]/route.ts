import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('*')
    .eq('id', params.id)
    .single()

  if (topicError || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const { data: author } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', topic.author_id)
    .single()

  return NextResponse.json({ topic, author })
}

// PATCH /api/topics/[id]
// Allows the topic author (or a moderator) to update the description/context field.
export async function PATCH(
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

  // Fetch the topic to verify ownership
  const { data: topic, error: fetchError } = await supabase
    .from('topics')
    .select('id, author_id, status')
    .eq('id', params.id)
    .single()

  if (fetchError || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // Check if user is the author or a moderator/elder
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isModerator = profile?.role === 'elder' || profile?.role === 'troll_catcher'
  const isAuthor = topic.author_id === user.id

  if (!isAuthor && !isModerator) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { description?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { description } = body

  // Allow null/empty to clear the description, otherwise validate length
  const trimmed = description?.trim() ?? null
  if (trimmed !== null && trimmed.length > 5000) {
    return NextResponse.json(
      { error: 'Description must be 5000 characters or fewer' },
      { status: 400 }
    )
  }

  // Update description. Also set tracking columns if they exist in the schema
  // (added by migration 00027). Cast to any to avoid type errors when the migration
  // has not yet been applied in local dev; the DB will simply ignore unknown columns.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: any = {
    description: trimmed || null,
    description_updated_at: new Date().toISOString(),
    description_updated_by: user.id,
  }

  const { data: updated, error: updateError } = await supabase
    .from('topics')
    .update(updatePayload)
    .eq('id', params.id)
    .select('*')
    .single()

  if (updateError) {
    // Graceful fallback: tracking columns may not exist yet in local dev
    const { data: fallback, error: fallbackError } = await supabase
      .from('topics')
      .update({ description: trimmed || null })
      .eq('id', params.id)
      .select('*')
      .single()

    if (fallbackError) {
      return NextResponse.json({ error: 'Failed to update topic' }, { status: 500 })
    }

    return NextResponse.json({ topic: fallback })
  }

  return NextResponse.json({ topic: updated })
}
